using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>An upcoming built-in holiday the group hasn't added, shown on Home.</summary>
public sealed record HolidaySuggestion(string Key, string Name, string Line);

public static class Holidays
{
    /// <summary>Built-in holidays within this many days that the group hasn't added are suggested on Home.</summary>
    public const int SuggestWithinDays = 45;

    /// <summary>Upcoming holidays that are neither added nor dismissed.</summary>
    public static IReadOnlyList<HolidaySuggestion> Suggested(IEnumerable<Holiday> holidays, DateTime? now = null) =>
        holidays.Where(h => h.OccasionId is null && !h.Dismissed && h.NextDate is { } d && Format.DaysUntil(d, now) <= SuggestWithinDays)
            .OrderBy(h => h.NextDate)
            .Select(h => new HolidaySuggestion(h.Key, h.Name, $"{Format.ShortDate(h.NextDate!.Value)} · {Format.InDays(h.NextDate.Value, now)} · not tracked yet"))
            .ToList();
}

/// <summary>A holiday on the "Which holidays do you celebrate?" checklist.</summary>
public sealed partial class HolidayCheck(Holiday holiday) : ObservableObject
{
    public string Key { get; } = holiday.Key;
    public string Name { get; } = holiday.Name;
    public string Hint { get; } = string.Join(" · ", new[] { holiday.NextDate is { } d ? $"Next: {Format.ShortDate(d)}" : null, holiday.Note }.Where(s => s is not null));
    [ObservableProperty] public partial bool IsOn { get; set; } = holiday.OccasionId is not null;
}

/// <summary>"Which holidays do you celebrate?": ticked ones are added for every family; the rest stop being suggested.</summary>
public sealed partial class HolidayChoiceViewModel(BestowdApi api, GroupState groups, INavigator nav, DataChanged changes) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private string _groupId = "";

    [ObservableProperty] public partial IReadOnlyList<HolidayCheck> Holidays { get; private set; } = [];

    public void Apply(IDictionary<string, object> p) => _groupId = Params.Get(p, Params.GroupId) ?? groups.GroupId ?? "";

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () => SetData(await api.ListHolidaysAsync(_groupId)));

    public void SetData(HolidayChoices choices)
    {
        Holidays = choices.Holidays.Where(h => h.NextDate is not null || h.OccasionId is not null).Select(h => new HolidayCheck(h)).ToList();
        HasLoaded = true;
    }

    [RelayCommand]
    public Task SaveAsync() => SaveAndCloseAsync(() => api.ChooseHolidaysAsync(_groupId, Holidays.Where(h => h.IsOn).Select(h => h.Key)));
}
