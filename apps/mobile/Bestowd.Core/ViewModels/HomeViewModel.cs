using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>Home: the next 30 days across all of the user's groups.</summary>
public sealed partial class HomeViewModel(BestowdApi api, INavigator nav, GroupState groups, DataChanged changes) : ViewModelBase, ILoadable
{
    [ObservableProperty] public partial IReadOnlyList<OccasionItem> Occasions { get; private set; } = [];
    [ObservableProperty] public partial OccasionType? Filter { get; private set; }
    [ObservableProperty] public partial string Headline { get; private set; } = "";
    [ObservableProperty] public partial string? NeedGiftsText { get; private set; }
    [ObservableProperty] public partial string? PlannedText { get; private set; }
    /// <summary>The current group hasn't said which holidays it celebrates yet.</summary>
    [ObservableProperty] public partial bool AskHolidays { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<HolidaySuggestion> SuggestedHolidays { get; private set; } = [];
    /// <summary>Requests to bring things into the current group: the owner reviews them.</summary>
    [ObservableProperty] public partial IReadOnlyList<MoveRequestRow> PendingMoves { get; private set; } = [];

    public bool IsEmpty => HasLoaded && Occasions.Count == 0 && Error is null;

    public static string Greeting(DateTime localNow) =>
        localNow.Hour < 12 ? "Good morning" : localNow.Hour < 18 ? "Good afternoon" : "Good evening";

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        var home = api.ListHomeOccasionsAsync(Filter);
        Task<HolidayChoices>? holidays = groups.GroupId is { } g ? api.ListHolidaysAsync(g) : null;
        Task<List<MoveRequestSummary>>? moves = groups.GroupId is { } g2 ? api.ListMoveRequestsAsync(g2) : null;
        Apply(await home);
        ApplyHolidays(holidays is null ? null : await holidays);
        var isOwner = groups.Current?.Role == MembershipRole.Owner;
        PendingMoves = moves is null ? [] : (await moves).Select(r => MoveRequestRow.From(r, isOwner)).ToList();
    });

    /// <summary>Fills the summary and list from a /me/occasions response.</summary>
    public void Apply(HomeOccasions home)
    {
        Occasions = home.Occasions.Select(o => OccasionItem.From(o, home.MultipleGroups)).ToList();
        var count = home.Occasions.Count;
        Headline = $"{count} {(count == 1 ? "occasion" : "occasions")} in the next 30 days";
        var need = home.Occasions.Count(o => o.Status == OccasionStatus.NotStarted);
        NeedGiftsText = need == 0 ? null : $"{need} need {(need == 1 ? "a gift" : "gifts")}";
        var planned = home.PlannedSpend.Where(p => p.Amount > 0).Select(p => Format.Money(p.Amount, p.Currency)).ToList();
        PlannedText = planned.Count == 0 ? null : $"{string.Join(" + ", planned)} planned";
        HasLoaded = true;
        OnPropertyChanged(nameof(IsEmpty));
    }

    /// <summary>Until the group answers, Home asks which holidays it celebrates; then it suggests upcoming ones not added.</summary>
    public void ApplyHolidays(HolidayChoices? choices, DateTime? now = null)
    {
        AskHolidays = choices is { Chosen: false };
        SuggestedHolidays = choices is { Chosen: true } ? Holidays.Suggested(choices.Holidays, now) : [];
    }

    [RelayCommand]
    public Task OpenMoveAsync(MoveRequestRow row) => nav.GoToAsync(Routes.MoveRequest, new Dictionary<string, object> { [Params.Id] = row.Id });

    [RelayCommand]
    public Task ChooseHolidaysAsync() => groups.GroupId is { } g
        ? nav.GoToAsync(Routes.HolidayChoice, new Dictionary<string, object> { [Params.GroupId] = g })
        : Task.CompletedTask;

    /// <summary>"Track it": adds the holiday for every family and opens it.</summary>
    [RelayCommand]
    public async Task TrackHolidayAsync(HolidaySuggestion suggestion)
    {
        if (groups.GroupId is not { } g) return;
        Occasion? created = null;
        if (!await RunAsync(async () => created = await api.CreateGroupOccasionAsync(g, new CreateGroupOccasionBody { HolidayKey = suggestion.Key }))) return;
        changes.Notify();
        await nav.GoToAsync(Routes.GroupOccasion, new Dictionary<string, object> { [Params.Id] = created!.Id });
    }

    /// <summary>"Not for us": stop suggesting the holiday.</summary>
    [RelayCommand]
    public Task DismissHolidayAsync(HolidaySuggestion suggestion) => groups.GroupId is not { } g ? Task.CompletedTask
        : RunAsync(async () => ApplyHolidays(await api.DismissHolidayAsync(g, suggestion.Key)));

    /// <summary>"ALL", "BIRTHDAY", "HOLIDAY" or "ONE_OFF".</summary>
    [RelayCommand]
    public async Task SetFilterAsync(string filter)
    {
        Filter = filter switch
        {
            "BIRTHDAY" => OccasionType.Birthday,
            "HOLIDAY" => OccasionType.Holiday,
            "ONE_OFF" => OccasionType.OneOff,
            _ => null,
        };
        await LoadAsync();
    }

    [RelayCommand]
    public Task OpenAsync(OccasionItem item)
    {
        var (route, id) = item.Target;
        return nav.GoToAsync(route, new Dictionary<string, object> { [Params.Id] = id });
    }

    [RelayCommand]
    public Task LogGiftAsync() => nav.GoToAsync(Routes.LogGift);
}
