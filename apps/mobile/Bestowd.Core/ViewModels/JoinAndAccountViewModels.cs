using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Auth;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public sealed partial class ShareOption(string field, string label, bool isOn) : ObservableObject
{
    public string Field { get; } = field;
    public string Label { get; } = label;
    [ObservableProperty] public partial bool IsOn { get; set; } = isOn;
}

/// <summary>Accepting an invite link: connect one of your families (choosing what to share), or join a group.</summary>
public sealed partial class JoinViewModel(BestowdApi api, Session session, GroupState groups, INavigator nav, DataChanged changes) : ViewModelBase, INavigationTarget, ILoadable
{
    [ObservableProperty] public partial string Token { get; private set; } = "";
    [ObservableProperty] public partial InvitePreview? Preview { get; private set; }
    [ObservableProperty] public partial bool LinkUnusable { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<FamilyListItem> Families { get; private set; } = [];
    [ObservableProperty] public partial FamilyListItem? SourceFamily { get; set; }
    [ObservableProperty] public partial bool Connected { get; private set; }
    /// <summary>Group invites: what you could bring from your own group, all ticked. Empty when there's nothing.</summary>
    [ObservableProperty] public partial IReadOnlyList<BringItem> BringItems { get; private set; } = [];
    [ObservableProperty] public partial string BringNote { get; private set; } = "";
    public bool CanBring => BringItems.Count > 0;

    public IReadOnlyList<ShareOption> Fields { get; } =
    [
        new("birthday", "Birthdays", true),
        new("likes", "What they love", true),
        new("avoid", "What to avoid", true),
        new("sizes", "Sizes", false),
        new("foodNotes", "Food notes", false),
        new("photo", "Photos", false),
    ];

    public bool IsFamily => Preview?.Kind == InviteKind.Family;
    public bool NeedsSignIn => !session.IsSignedIn;
    public string Title => Preview is null ? "" : IsFamily ? $"Connect as {Preview.FamilyName} on Bestowd" : $"Join {Preview.GroupName}";
    public string Explanation => Preview is null ? "" : IsFamily
        ? $"{Preview.InviterName} will see the details you choose below, read-only. Nothing else in your account is shared."
        : $"You'll see and add to everything in {Preview.GroupName}: families, gifts and ideas, and you'll be in its household.";


    public void Apply(IDictionary<string, object> parameters) => Token = Params.Get(parameters, Params.Token) ?? "";

    [RelayCommand]
    public async Task LoadAsync()
    {
        LinkUnusable = false;
        try
        {
            IsBusy = true;
            Preview = await api.GetInviteAsync(Token);
        }
        catch (ApiException e) when (e.IsGone || e.IsNotFound)
        {
            LinkUnusable = true;
            return;
        }
        catch (Exception e) when (e is ApiException or HttpRequestException)
        {
            Error = "Couldn't open this invite.";
            return;
        }
        finally { IsBusy = false; }

        if (IsFamily && session.IsSignedIn && groups.GroupId is { } groupId)
        {
            await RunAsync(async () =>
            {
                Families = await api.ListFamiliesAsync(groupId);
                SourceFamily = Families.FirstOrDefault(f => f.IsOwnHousehold) ?? Families.FirstOrDefault();
            });
        }
        else if (!IsFamily && session.IsSignedIn)
        {
            MovableItems? movable = null;
            try { movable = await api.GetMovableAsync(Token); }
            catch (Exception e) when (e is ApiException or HttpRequestException) { }
            BringItems = movable is null ? [] : BringChecklist.From(movable);
            BringNote = movable is null ? "" : $"From {movable.GroupName}. {Preview!.GroupName}'s owner reviews what you bring before it's added, and can combine anything that looks like what they already have. Once everything has moved, {movable.GroupName} is removed.";
        }
        HasLoaded = true;
        foreach (var name in new[] { nameof(IsFamily), nameof(NeedsSignIn), nameof(Title), nameof(Explanation), nameof(CanBring) }) OnPropertyChanged(name);
    }

    public AcceptInviteBody BodyForAccept() => IsFamily
        ? new AcceptInviteBody { SourceFamilyId = SourceFamily?.Id, SharedFields = Fields.Where(f => f.IsOn).Select(f => f.Field).ToList() }
        : new AcceptInviteBody { Bring = BringChecklist.ToSelection(BringItems) is { IsEmpty: false } s ? s : null };

    [RelayCommand]
    public async Task AcceptAsync()
    {
        AcceptInviteResult? result = null;
        if (!await RunAsync(async () => result = await api.AcceptInviteAsync(Token, BodyForAccept()))) return;
        changes.Notify();
        if (result!.GroupId is { } joined)
        {
            await session.LoadAsync();
            groups.Select(joined);
            await nav.GoToAsync(Routes.Home);
        }
        else Connected = true;
    }

    [RelayCommand] public Task SignInAsync() => nav.GoToAsync(Routes.SignIn);
    [RelayCommand] public Task DoneAsync() => nav.GoToAsync(Routes.Home);
}

public sealed record AiProviderOption(string Value, string Label, string KeyHelp);

public sealed partial class BudgetField(OccasionType type, string label, string text) : ObservableObject
{
    public OccasionType Type { get; } = type;
    public string Label { get; } = label;
    [ObservableProperty] public partial string Text { get; set; } = text;
}

/// <summary>Account: profile, groups, the current group's settings (owner only), inviting someone, signing out.</summary>
public sealed partial class AccountViewModel(BestowdApi api, Session session, GroupState groups, INavigator nav, IPrompts prompts) : ViewModelBase, ILoadable
{
    /// <summary>Requests to bring things into this group: all for the owner, your own for anyone else.</summary>
    [ObservableProperty] public partial IReadOnlyList<MoveRequestRow> PendingMoves { get; private set; } = [];
    /// <summary>You have things in your own group you could still bring here.</summary>
    [ObservableProperty] public partial bool CanBring { get; private set; }
    public string LeaveText => IsOwner ? "Leave or delete group" : "Leave group";

    // ---- AI for reading photos ----
    public static IReadOnlyList<AiProviderOption> AiProviders { get; } =
    [
        new("anthropic", "Anthropic (Claude)", "Create a key at console.anthropic.com → API keys."),
        new("openai", "OpenAI", "Create a key at platform.openai.com → API keys."),
        new("google", "Google (Gemini)", "Create a key at aistudio.google.com → Get API key."),
    ];
    public IReadOnlyList<AiProviderOption> AiProviderOptions => AiProviders;
    private AiSettings? _ai;
    [ObservableProperty, NotifyPropertyChangedFor(nameof(AiKeyHelp), nameof(AiModelHelp))] public partial AiProviderOption? AiProvider { get; set; }
    [ObservableProperty] public partial string AiModel { get; set; } = "";
    [ObservableProperty] public partial string AiKey { get; set; } = "";
    [ObservableProperty] public partial string? AiStatus { get; private set; }
    [ObservableProperty] public partial bool AiConfigured { get; private set; }
    public string AiModelHelp => AiProvider?.Value == "anthropic"
        ? $"Leave blank for {_ai?.DefaultModel ?? "claude-opus-5-5"}. claude-haiku-5-5 costs less."
        : "Required: the model name from your provider's console.";
    public string AiKeyHelp => _ai?.KeyHint is { } hint && _ai.Provider == AiProvider?.Value
        ? $"A key ending in {hint} is saved. Leave blank to keep it. {AiProvider?.KeyHelp}"
        : AiProvider?.KeyHelp ?? "";

    public void SetAi(AiSettings ai)
    {
        _ai = ai;
        AiConfigured = ai.Configured;
        AiProvider = AiProviders.FirstOrDefault(p => p.Value == ai.Provider) ?? AiProviders[0];
        AiModel = ai.Model ?? "";
        AiKey = "";
        var label = AiProviders.FirstOrDefault(p => p.Value == ai.Provider)?.Label;
        AiStatus = ai.Configured
            ? (IsOwner ? $"Using {label}." : $"Reading photos of items uses {label}, set up by the group's owner.")
            : (IsOwner ? "Not set up." : "Reading details from photos isn't set up. The group's owner can add an AI key here.");
        OnPropertyChanged(nameof(AiKeyHelp));
        OnPropertyChanged(nameof(AiModelHelp));
    }

    [RelayCommand]
    public async Task SaveAiAsync()
    {
        if (groups.GroupId is not { } g || AiProvider is null) return;
        AiSettings? saved = null;
        if (await RunAsync(async () => saved = await api.SaveAiSettingsAsync(g, new SaveAiSettingsBody
            {
                Provider = AiProvider.Value,
                Model = AiModel.Trim() is { Length: > 0 } m ? m : null,
                ApiKey = AiKey.Trim() is { Length: > 0 } k ? k : null,
            })))
            SetAi(saved!);
    }

    [RelayCommand]
    public async Task RemoveAiAsync()
    {
        if (groups.GroupId is not { } g) return;
        if (await RunAsync(() => api.RemoveAiSettingsAsync(g))) SetAi(new AiSettings());
    }

    [ObservableProperty] public partial string GroupName { get; set; } = "";
    [ObservableProperty] public partial string Currency { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyList<Formatting.CurrencyOption> CurrencyOptions { get; private set; } = Formatting.Currencies.All;
    /// <summary>The picked currency; sets <see cref="Currency"/>.</summary>
    [ObservableProperty] public partial Formatting.CurrencyOption? CurrencyChoice { get; set; }

    partial void OnCurrencyChoiceChanged(Formatting.CurrencyOption? value) { if (value is not null) Currency = value.Code; }
    [ObservableProperty] public partial string ReminderDays { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyList<BudgetField> Budgets { get; private set; } = [];
    [ObservableProperty] public partial string? SavedText { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<OccasionItem> GroupOccasions { get; private set; } = [];
    /// <summary>The built-in holidays the group celebrates, e.g. "Christmas, Easter", or a prompt when none.</summary>
    [ObservableProperty] public partial string HolidaysText { get; private set; } = "";

    public bool HasNoGroupOccasions => HasLoaded && GroupOccasions.Count == 0;

    public User? User => session.User;
    public GroupState Groups => groups;
    public bool IsOwner => groups.Current?.Role == MembershipRole.Owner;

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        if (groups.GroupId is not { } groupId) return;
        var occasions = api.ListOccasionsAsync(groupId, to: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(366)));
        var holidays = api.ListHolidaysAsync(groupId);
        var moves = api.ListMoveRequestsAsync(groupId);
        var movable = api.GetGroupMovableAsync(groupId);
        var ai = api.GetAiSettingsAsync(groupId);
        var group = await api.GetGroupAsync(groupId);
        GroupName = group.Name;
        Currency = group.Currency;
        CurrencyOptions = Formatting.Currencies.WithCurrent(group.Currency);
        CurrencyChoice = CurrencyOptions.FirstOrDefault(o => o.Code == group.Currency);
        ReminderDays = string.Join(", ", group.DefaultReminderDays);
        Budgets = new[] { OccasionType.Birthday, OccasionType.Holiday, OccasionType.OneOff }
            .Select(t => new BudgetField(t, Formatting.Format.Label(t),
                group.DefaultBudgets.TryGetValue(ApiJson.EnumName(t), out var b) ? b.ToString(System.Globalization.CultureInfo.CurrentCulture) : ""))
            .ToList();
        GroupOccasions = (await occasions).Occasions.Where(o => o.IsGroupWide).Select(o => OccasionItem.From(o)).ToList();
        HolidaysText = HolidaysSummary(await holidays);
        PendingMoves = (await moves).Select(r => MoveRequestRow.From(r, IsOwner)).ToList();
        var m = await movable;
        CanBring = m.Movable is not null && !m.Pending;
        SetAi(await ai);
        HasLoaded = true;
        OnPropertyChanged(nameof(IsOwner));
        OnPropertyChanged(nameof(LeaveText));
        OnPropertyChanged(nameof(User));
        OnPropertyChanged(nameof(HasNoGroupOccasions));
    });

    /// <summary>The settings PATCH, or null with <see cref="ViewModelBase.Error"/> set when a field is invalid.</summary>
    public Patch? BuildSettingsPatch()
    {
        var currency = Currency.Trim().ToUpperInvariant();
        if (currency.Length != 3 || !currency.All(char.IsAsciiLetterUpper)) { Error = "Choose a currency."; return null; }
        var days = new List<int>();
        foreach (var part in Formatting.Format.SplitList(ReminderDays))
        {
            if (!int.TryParse(part, out var d) || d is < 0 or > 365) { Error = "Reminder days are whole numbers from 0 to 365."; return null; }
            days.Add(d);
        }
        if (days.Count > 5) { Error = "Up to five reminder days."; return null; }
        var budgets = new Dictionary<string, decimal>();
        foreach (var b in Budgets.Where(b => b.Text.Trim().Length > 0))
        {
            if (!decimal.TryParse(b.Text, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.CurrentCulture, out var amount) || amount < 0) { Error = $"{b.Label} budget must be a number."; return null; }
            budgets[ApiJson.EnumName(b.Type)] = amount;
        }
        if (GroupName.Trim().Length == 0) { Error = "The group needs a name."; return null; }
        Error = null;
        return new Patch().Set("name", GroupName.Trim()).Set("currency", currency).Set("defaultBudgets", budgets).SetNumbers("defaultReminderDays", days);
    }

    [RelayCommand]
    public async Task SaveAsync()
    {
        if (groups.GroupId is not { } groupId || BuildSettingsPatch() is not { } patch) return;
        if (await RunAsync(() => api.UpdateGroupAsync(groupId, patch)))
        {
            await session.LoadAsync();
            SavedText = "Saved";
        }
    }

    [RelayCommand]
    public async Task SwitchGroupAsync(Membership membership)
    {
        groups.Select(membership.GroupId);
        OnPropertyChanged(nameof(IsOwner));
        await LoadAsync();
    }

    [RelayCommand]
    public async Task InviteAsync()
    {
        if (groups.GroupId is not { } groupId) return;
        InviteLink? link = null;
        if (!await RunAsync(async () => link = await api.CreateInviteAsync(groupId, InviteKind.Group))) return;
        await prompts.ShareAsync("Join my group on Bestowd", $"Join my group on Bestowd so we can plan gifts together: {link!.Url}");
    }

    [RelayCommand]
    public Task AddGroupOccasionAsync() => groups.GroupId is { } g
        ? nav.GoToAsync(Routes.GroupOccasionForm, new Dictionary<string, object> { [Params.GroupId] = g })
        : Task.CompletedTask;

    public static string HolidaysSummary(HolidayChoices choices)
    {
        var names = choices.Holidays.Where(h => h.OccasionId is not null).Select(h => h.Name).ToList();
        return names.Count > 0 ? string.Join(", ", names) : choices.Chosen ? "None" : "Not chosen yet";
    }

    [RelayCommand]
    public Task ChooseHolidaysAsync() => groups.GroupId is { } g
        ? nav.GoToAsync(Routes.HolidayChoice, new Dictionary<string, object> { [Params.GroupId] = g })
        : Task.CompletedTask;

    [RelayCommand]
    public Task OpenOccasionAsync(OccasionItem item) => nav.GoToAsync(Routes.GroupOccasion, new Dictionary<string, object> { [Params.Id] = item.Occasion.Id });

    [RelayCommand]
    public Task OpenMoveAsync(MoveRequestRow row) => nav.GoToAsync(Routes.MoveRequest, new Dictionary<string, object> { [Params.Id] = row.Id });

    [RelayCommand]
    public Task BringAsync() => groups.GroupId is { } g
        ? nav.GoToAsync(Routes.Bring, new Dictionary<string, object> { [Params.GroupId] = g })
        : Task.CompletedTask;

    /// <summary>Leave the current group: choose what to take a copy of on the Leave screen.</summary>
    [RelayCommand]
    public Task LeaveAsync() => groups.GroupId is { } g
        ? nav.GoToAsync(Routes.Leave, new Dictionary<string, object> { [Params.GroupId] = g })
        : Task.CompletedTask;

    /// <summary>Start a new, empty group of your own and open it.</summary>
    [RelayCommand]
    public async Task StartGroupAsync()
    {
        var name = await prompts.AskTextAsync("Start a new group", "A fresh group with just your household. Your other groups stay as they are.", "e.g. Our family");
        if (name is null) return;
        Group? created = null;
        if (!await RunAsync(async () => created = await api.CreateGroupAsync(string.IsNullOrWhiteSpace(name) ? null : name.Trim()))) return;
        await session.LoadAsync();
        groups.Select(created!.Id);
        await nav.GoToAsync(Routes.Home);
    }

    [RelayCommand]
    public async Task SignOutAsync()
    {
        await session.SignOutAsync();
        await nav.GoToAsync(Routes.SignIn);
    }
}
