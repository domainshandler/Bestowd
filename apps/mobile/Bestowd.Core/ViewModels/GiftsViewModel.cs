using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public enum GiftFilter { All, Given, Received, Planned }

/// <summary>Gifts: a year's history in the current group, grouped by occasion, with given/received/spent totals.</summary>
public sealed partial class GiftsViewModel(BestowdApi api, GroupState groups, INavigator nav, DataChanged changes) : ViewModelBase, ILoadable
{
    [ObservableProperty] public partial int? Year { get; set; } = DateTime.UtcNow.Year;
    [ObservableProperty] public partial GiftFilter Filter { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<GiftSection> Sections { get; private set; } = [];
    [ObservableProperty] public partial string GivenText { get; private set; } = "–";
    [ObservableProperty] public partial string ReceivedText { get; private set; } = "–";
    [ObservableProperty] public partial string SpentText { get; private set; } = "–";
    [ObservableProperty] public partial string? ThankYouText { get; private set; }

    /// <summary>The last six years, then "All years" (null).</summary>
    public IReadOnlyList<int?> Years { get; } = Enumerable.Range(0, 6).Select(i => (int?)(DateTime.UtcNow.Year - i)).Append(null).ToList();

    public bool IsEmpty => HasLoaded && Sections.Count == 0 && Error is null;
    public string EmptyText => Filter == GiftFilter.Planned ? "Nothing bought and waiting to be given." : "No gifts logged for this period.";

    partial void OnYearChanged(int? value) => LoadCommand.Execute(null);

    /// <summary>The query a filter maps to: Planned means bought but not yet given.</summary>
    public static (GiftDirection? Direction, GiftStatus? Status) QueryFor(GiftFilter filter) => filter switch
    {
        GiftFilter.Given => (GiftDirection.Given, null),
        GiftFilter.Received => (GiftDirection.Received, null),
        GiftFilter.Planned => (GiftDirection.Given, GiftStatus.Bought),
        _ => (null, null),
    };

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        if (groups.GroupId is not { } groupId) return;
        var (direction, status) = QueryFor(Filter);
        SetData(await api.ListGiftsAsync(groupId, Year, direction, status));
    });

    public void SetData(GiftList list)
    {
        Sections = GiftGrouping.ByOccasionAndYear(list.Gifts, list.Currency);
        GivenText = list.Totals.GivenCount.ToString(System.Globalization.CultureInfo.CurrentCulture);
        ReceivedText = list.Totals.ReceivedCount.ToString(System.Globalization.CultureInfo.CurrentCulture);
        SpentText = Compact(list.Totals.Spent, list.Currency);
        var due = list.Totals.ThankYouDueCount;
        ThankYouText = due == 0 ? null : $"{due} thank-you{(due == 1 ? "" : "s")} due";
        HasLoaded = true;
        OnPropertyChanged(nameof(IsEmpty));
        OnPropertyChanged(nameof(EmptyText));
    }

    public static string Compact(decimal amount, string currency) =>
        amount >= 1000 ? Format.Money(Math.Round(amount / 100) / 10, currency) + "k" : Format.Money(amount, currency);

    [RelayCommand]
    public Task SetFilterAsync(string filter)
    {
        Filter = Enum.TryParse<GiftFilter>(filter, ignoreCase: true, out var f) ? f : GiftFilter.All;
        return LoadAsync();
    }

    /// <summary>Shows a received gift's value. This also counts it in received totals.</summary>
    [RelayCommand]
    public Task RevealAsync(GiftItem item) => Update(item, new Patch().Set("valueHidden", false));

    [RelayCommand]
    public Task MarkThankedAsync(GiftItem item) => Update(item, new Patch().Set("thankYouSent", true));

    private async Task Update(GiftItem item, Patch patch)
    {
        if (await RunAsync(() => api.UpdateGiftAsync(item.Gift.Id, patch))) { changes.Notify(); await LoadAsync(); }
    }

    [RelayCommand]
    public Task LogGiftAsync() => groups.GroupId is { } g
        ? nav.GoToAsync(Routes.LogGift, new Dictionary<string, object> { [Params.GroupId] = g })
        : Task.CompletedTask;

    [RelayCommand]
    public Task EditAsync(GiftItem item) => nav.GoToAsync(Routes.LogGift, new Dictionary<string, object> { [Params.GroupId] = item.Gift.GroupId, [Params.Id] = item.Gift.Id });
}
