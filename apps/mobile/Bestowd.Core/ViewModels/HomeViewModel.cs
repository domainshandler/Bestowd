using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>Home: the next 30 days across all of the user's groups.</summary>
public sealed partial class HomeViewModel(BestowdApi api, INavigator nav) : ViewModelBase, ILoadable
{
    [ObservableProperty] public partial IReadOnlyList<OccasionItem> Occasions { get; private set; } = [];
    [ObservableProperty] public partial OccasionType? Filter { get; private set; }
    [ObservableProperty] public partial string Headline { get; private set; } = "";
    [ObservableProperty] public partial string? NeedGiftsText { get; private set; }
    [ObservableProperty] public partial string? PlannedText { get; private set; }

    public bool IsEmpty => HasLoaded && Occasions.Count == 0 && Error is null;

    public static string Greeting(DateTime localNow) =>
        localNow.Hour < 12 ? "Good morning" : localNow.Hour < 18 ? "Good afternoon" : "Good evening";

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        var home = await api.ListHomeOccasionsAsync(Filter);
        Apply(home);
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
