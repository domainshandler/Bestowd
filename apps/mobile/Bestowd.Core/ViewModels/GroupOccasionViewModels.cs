using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>One covered family on a group-wide occasion's screen.</summary>
public sealed record FamilyShareRow(FamilyShare Share, string Line, string? StatusText)
{
    public bool NeedsGift => StatusText is null;
}

/// <summary>A group-wide occasion (a holiday or your own): progress, spend and budget per family.</summary>
public sealed partial class GroupOccasionViewModel(BestowdApi api, INavigator nav, IPrompts prompts, DataChanged changes) : ViewModelBase, INavigationTarget, ILoadable
{
    [ObservableProperty] public partial string OccasionId { get; private set; } = "";
    [ObservableProperty] public partial Occasion? Occasion { get; private set; }
    [ObservableProperty] public partial string DateText { get; private set; } = "";
    [ObservableProperty] public partial string ProgressText { get; private set; } = "";
    [ObservableProperty] public partial string SpentText { get; private set; } = "";
    [ObservableProperty] public partial string BudgetText { get; private set; } = "";
    [ObservableProperty] public partial IReadOnlyList<FamilyShareRow> Families { get; private set; } = [];

    public bool HasNoFamilies => HasLoaded && Families.Count == 0;
    public string RemoveText => $"Remove {Occasion?.Name}";

    public void Apply(IDictionary<string, object> parameters) => OccasionId = Params.Get(parameters, Params.Id) ?? "";

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () => SetData(await api.GetOccasionAsync(OccasionId)));

    public void SetData(Occasion o, DateTime? now = null)
    {
        Occasion = o;
        var c = o.Coverage ?? new OccasionCoverage();
        DateText = o.NextOccurrence is { } next
            ? $"{Format.LongDate(next)} · {Format.InDays(next, now)}{(o.RecursAnnually ? " · every year" : "")}"
            : "No upcoming date";
        ProgressText = $"{c.CoveredCount} of {c.FamilyCount}";
        SpentText = Format.Money(o.Spent, o.Currency);
        BudgetText = o.EffectiveBudget is null ? "–" : Format.Money(o.EffectiveBudget, o.Currency);
        Families = c.Families.Select(f => new FamilyShareRow(f, ShareLine(f, o.Currency), f.Given ? "Given" : f.Covered ? "Bought" : null)).ToList();
        HasLoaded = true;
        OnPropertyChanged(nameof(HasNoFamilies));
        OnPropertyChanged(nameof(RemoveText));
    }

    /// <summary>"School · CA$5 of CA$20 (just for them)".</summary>
    public static string ShareLine(FamilyShare f, string currency)
    {
        var line = Format.Label(f.Type);
        if (f.Budget is { } budget)
        {
            line += f.Spent > 0 ? $" · {Format.Money(f.Spent, currency)} of {Format.Money(budget, currency)}" : $" · Budget {Format.Money(budget, currency)}";
            if (f.BudgetOverride is not null) line += " (just for them)";
        }
        return line;
    }

    [RelayCommand]
    public Task LogGiftAsync(FamilyShareRow row) => Occasion is null ? Task.CompletedTask : nav.GoToAsync(Routes.LogGift, new Dictionary<string, object>
    {
        [Params.GroupId] = Occasion.GroupId,
        [Params.FamilyId] = row.Share.FamilyId,
        [Params.OccasionId] = Occasion.Id,
    });

    [RelayCommand]
    public Task OpenFamilyAsync(FamilyShareRow row) => nav.GoToAsync(Routes.Family, new Dictionary<string, object> { [Params.Id] = row.Share.FamilyId });

    [RelayCommand]
    public Task EditAsync() => Occasion is null ? Task.CompletedTask : nav.GoToAsync(Routes.GroupOccasionForm, new Dictionary<string, object>
    {
        [Params.GroupId] = Occasion.GroupId,
        [Params.Id] = Occasion.Id,
    });

    [RelayCommand]
    public async Task RemoveAsync()
    {
        if (Occasion is null || !await prompts.ConfirmAsync($"Remove {Occasion.Name}?", "Gifts already logged stay in the history.", "Remove")) return;
        if (await RunAsync(() => api.DeleteOccasionAsync(OccasionId))) { changes.Notify(); await nav.GoBackAsync(); }
    }
}

/// <summary>A built-in holiday to pick, or (Key null) your own occasion.</summary>
public sealed record HolidayOption(string? Key, string Label, string? Note);

/// <summary>A budget for one type of family; empty uses the occasion's budget.</summary>
public sealed partial class TypeBudgetField(FamilyType type, string text) : ObservableObject
{
    public FamilyType Type { get; } = type;
    public string Label { get; } = Format.Label(type);
    [ObservableProperty] public partial string Text { get; set; } = text;
}

/// <summary>A family that can be covered, with its own budget (empty = the defaults).</summary>
public sealed partial class FamilyPick(FamilyListItem family, bool isOn, string budget) : ObservableObject
{
    public string FamilyId { get; } = family.Id;
    public string Name { get; } = family.Name;
    public string Hint { get; } = family.IsOwnHousehold ? "Your household" : Format.Label(family.Type);
    [ObservableProperty] public partial bool IsOn { get; set; } = isOn;
    [ObservableProperty] public partial string Budget { get; set; } = budget;
}

/// <summary>
/// Adds a group-wide occasion (a built-in holiday or your own) or edits one: which families it covers,
/// the budget per family, budgets by type of family, and each family's own budget.
/// </summary>
public sealed partial class GroupOccasionFormViewModel(BestowdApi api, GroupState groups, INavigator nav, DataChanged changes) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private string _groupId = "";
    private Occasion? _editing;

    [ObservableProperty] public partial string? OccasionId { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<HolidayOption> Holidays { get; private set; } = [new(null, "Your own occasion", null)];
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsCustom), nameof(HolidayNote))]
    [NotifyCanExecuteChangedFor(nameof(SaveCommand))]
    public partial HolidayOption? Holiday { get; set; }
    [ObservableProperty][NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Name { get; set; } = "";
    [ObservableProperty] public partial DateTime Date { get; set; } = DateTime.Today;
    [ObservableProperty] public partial bool RecursAnnually { get; set; } = true;
    [ObservableProperty] public partial string Budget { get; set; } = "";
    [ObservableProperty] public partial bool IncludeNewFamilies { get; set; } = true;
    [ObservableProperty] public partial IReadOnlyList<FamilyPick> Families { get; private set; } = [];

    public IReadOnlyList<TypeBudgetField> TypeBudgets { get; } = Enum.GetValues<FamilyType>().Select(t => new TypeBudgetField(t, "")).ToList();

    public bool IsEditing => OccasionId is not null;
    public bool IsCustom => !IsEditing && Holiday?.Key is null;
    public bool ChoosesOccasion => !IsEditing;
    public string? HolidayNote => Holiday?.Note;
    public string ScreenTitle => IsEditing ? "Families & budgets" : "Add a group occasion";

    public void Apply(IDictionary<string, object> parameters)
    {
        _groupId = Params.Get(parameters, Params.GroupId) ?? groups.GroupId ?? "";
        OccasionId = Params.Get(parameters, Params.Id);
        foreach (var name in new[] { nameof(IsEditing), nameof(IsCustom), nameof(ChoosesOccasion), nameof(ScreenTitle) }) OnPropertyChanged(name);
    }

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        var families = api.ListFamiliesAsync(_groupId);
        if (OccasionId is not null)
        {
            SetData(await families, await api.GetOccasionAsync(OccasionId), []);
        }
        else
        {
            var holidays = api.ListHolidaysAsync(_groupId);
            SetData(await families, null, (await holidays).Holidays);
        }
    });

    public void SetData(IReadOnlyList<FamilyListItem> families, Occasion? editing, IReadOnlyList<Holiday> holidays)
    {
        _editing = editing;
        if (editing is null)
        {
            // Holidays the group already has aren't offered again; the first one left is preselected.
            Holidays = holidays.Where(h => h.OccasionId is null && h.NextDate is not null)
                .Select(h => new HolidayOption(h.Key, $"{h.Name} · {Format.ShortDate(h.NextDate!.Value)}", h.Note))
                .Append(new HolidayOption(null, "Your own occasion", null))
                .ToList();
            Holiday = Holidays[0];
            Families = families.Select(f => new FamilyPick(f, true, "")).ToList();
        }
        else
        {
            var shares = (editing.Coverage?.Families ?? []).ToDictionary(f => f.FamilyId);
            Families = families.Select(f => new FamilyPick(f, shares.ContainsKey(f.Id), shares.GetValueOrDefault(f.Id)?.BudgetOverride is { } b ? Money(b) : "")).ToList();
            Budget = editing.Budget is { } budget ? Money(budget) : "";
            IncludeNewFamilies = editing.IncludeNewFamilies;
            Name = editing.Name;
            foreach (var field in TypeBudgets)
                field.Text = editing.FamilyTypeBudgets.TryGetValue(ApiJson.EnumName(field.Type), out var v) ? Money(v) : "";
        }
        HasLoaded = true;
        OnPropertyChanged(nameof(IsCustom));
        SaveCommand.NotifyCanExecuteChanged();
    }

    private static string Money(decimal d) => d.ToString(CultureInfo.CurrentCulture);

    private bool CanSave() => !IsCustom || Name.Trim().Length > 0;

    /// <summary>The budgets per family type to save (empty fields left out).</summary>
    public Dictionary<string, decimal> BuildTypeBudgets()
    {
        var result = new Dictionary<string, decimal>();
        foreach (var f in TypeBudgets)
            if (ParseMoney(f.Text) is { } amount) result[ApiJson.EnumName(f.Type)] = amount;
        return result;
    }

    /// <summary>The covered families and their own budgets.</summary>
    public List<FamilyBudget> BuildFamilies() =>
        Families.Where(f => f.IsOn).Select(f => new FamilyBudget { FamilyId = f.FamilyId, Budget = ParseMoney(f.Budget) }).ToList();

    public CreateGroupOccasionBody? BuildCreateBody()
    {
        CreateGroupOccasionBody? body = null;
        Validate(() =>
        {
            var shared = (Budget: ParseMoney(Budget), Types: BuildTypeBudgets(), FamilyIds: Families.Where(f => f.IsOn).Select(f => f.FamilyId).ToList());
            body = Holiday?.Key is { } key
                ? new CreateGroupOccasionBody { HolidayKey = key, Budget = shared.Budget, FamilyTypeBudgets = shared.Types, IncludeNewFamilies = IncludeNewFamilies, FamilyIds = shared.FamilyIds }
                : new CreateGroupOccasionBody
                {
                    Type = OccasionType.Holiday,
                    Name = Name.Trim(),
                    Date = DateOnly.FromDateTime(Date).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    RecursAnnually = RecursAnnually,
                    Budget = shared.Budget,
                    FamilyTypeBudgets = shared.Types,
                    IncludeNewFamilies = IncludeNewFamilies,
                    FamilyIds = shared.FamilyIds,
                };
        });
        return body;
    }

    [RelayCommand(CanExecute = nameof(CanSave))]
    public Task SaveAsync()
    {
        if (_editing is { } editing)
        {
            Patch? patch = null;
            List<FamilyBudget>? families = null;
            if (!Validate(() =>
            {
                patch = new Patch().Set("budget", ParseMoney(Budget)).Set("familyTypeBudgets", BuildTypeBudgets()).Set("includeNewFamilies", IncludeNewFamilies);
                families = BuildFamilies();
            })) return Task.CompletedTask;
            return SaveAndCloseAsync(async () =>
            {
                await api.UpdateOccasionAsync(editing.Id, patch!);
                await api.SetOccasionFamiliesAsync(editing.Id, families!);
            });
        }

        if (BuildCreateBody() is not { } body) return Task.CompletedTask;
        List<FamilyBudget>? overrides = null;
        if (!Validate(() => overrides = BuildFamilies())) return Task.CompletedTask;
        return SaveAndCloseAsync(async () =>
        {
            var created = await api.CreateGroupOccasionAsync(_groupId, body);
            // Families' own budgets are set after the occasion exists.
            if (overrides!.Any(f => f.Budget is not null)) await api.SetOccasionFamiliesAsync(created.Id, overrides!);
        });
    }
}
