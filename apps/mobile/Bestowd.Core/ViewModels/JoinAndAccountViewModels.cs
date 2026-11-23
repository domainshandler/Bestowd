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
        : $"You'll see and add to everything in {Preview.GroupName}: families, gifts and ideas. Your own group stays yours.";

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
        HasLoaded = true;
        foreach (var name in new[] { nameof(IsFamily), nameof(NeedsSignIn), nameof(Title), nameof(Explanation) }) OnPropertyChanged(name);
    }

    public AcceptInviteBody BodyForAccept() => IsFamily
        ? new AcceptInviteBody { SourceFamilyId = SourceFamily?.Id, SharedFields = Fields.Where(f => f.IsOn).Select(f => f.Field).ToList() }
        : new AcceptInviteBody();

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

public sealed partial class BudgetField(OccasionType type, string label, string text) : ObservableObject
{
    public OccasionType Type { get; } = type;
    public string Label { get; } = label;
    [ObservableProperty] public partial string Text { get; set; } = text;
}

/// <summary>Account: profile, groups, the current group's settings (owner only), inviting someone, signing out.</summary>
public sealed partial class AccountViewModel(BestowdApi api, Session session, GroupState groups, INavigator nav, IPrompts prompts) : ViewModelBase, ILoadable
{
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
        HasLoaded = true;
        OnPropertyChanged(nameof(IsOwner));
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
    public async Task SignOutAsync()
    {
        await session.SignOutAsync();
        await nav.GoToAsync(Routes.SignIn);
    }
}
