using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public sealed record FamilyCard(FamilyListItem Family, string Subtitle, string? NextLine, IReadOnlyList<string> Initials, string? MoreText);

public sealed record PersonRow(PersonListItem Person, string Initials, string Subtitle);

/// <summary>People: families or everyone in the current group, with search.</summary>
public sealed partial class PeopleViewModel(BestowdApi api, GroupState groups, INavigator nav) : ViewModelBase
{
    private List<FamilyListItem> _families = [];
    private List<PersonListItem> _people = [];

    [ObservableProperty] public partial bool ShowEveryone { get; set; }
    [ObservableProperty] public partial string Search { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyList<FamilyCard> Families { get; private set; } = [];
    [ObservableProperty] public partial IReadOnlyList<PersonRow> People { get; private set; } = [];

    partial void OnSearchChanged(string value) => Refilter();
    partial void OnShowEveryoneChanged(bool value) => Refilter();

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        if (groups.GroupId is not { } groupId) return;
        var families = api.ListFamiliesAsync(groupId);
        var people = api.ListPeopleAsync(groupId);
        SetData(await families, await people);
    });

    public void SetData(List<FamilyListItem> families, List<PersonListItem> people)
    {
        _families = families;
        _people = people;
        HasLoaded = true;
        Refilter();
    }

    private void Refilter()
    {
        var q = Search.Trim();
        bool Match(string s) => q.Length == 0 || s.Contains(q, StringComparison.CurrentCultureIgnoreCase);

        var namesByFamily = _people.GroupBy(p => p.FamilyId).ToDictionary(g => g.Key, g => g.Select(p => p.Name).ToList());
        var familiesWithMatches = _people.Where(p => Match(p.Name)).Select(p => p.FamilyId).ToHashSet();

        Families = _families
            .Where(f => Match(f.Name) || familiesWithMatches.Contains(f.Id))
            .Select(f =>
            {
                var names = namesByFamily.GetValueOrDefault(f.Id) ?? [];
                var kind = f.IsOwnHousehold ? "Your household" : Format.Label(f.Type);
                var subtitle = $"{kind} · {f.MemberCount} {(f.MemberCount == 1 ? "person" : "people")}";
                var next = f.NextOccasion is { } n ? $"Next: {n.Name} · {Format.ShortDate(n.NextOccurrence)}" : null;
                return new FamilyCard(f, subtitle, next, names.Take(2).Select(Format.Initials).ToList(), names.Count > 2 ? $"+{names.Count - 2}" : null);
            })
            .ToList();

        People = _people
            .Where(p => Match(p.Name) || Match(p.FamilyName))
            .Select(p => new PersonRow(p, Format.Initials(p.Name), string.Join(" · ",
                new[] { p.FamilyName, p.Age?.ToString(System.Globalization.CultureInfo.CurrentCulture), Format.Birthday(p.BirthMonth, p.BirthDay) }
                    .Where(s => !string.IsNullOrEmpty(s)))))
            .ToList();
    }

    [RelayCommand]
    public Task OpenFamilyAsync(FamilyCard card) => nav.GoToAsync(Routes.Family, new Dictionary<string, object> { [Params.Id] = card.Family.Id });

    [RelayCommand]
    public Task OpenPersonAsync(PersonRow row) => nav.GoToAsync(Routes.Person, new Dictionary<string, object> { [Params.Id] = row.Person.Id });

    [RelayCommand]
    public Task AddFamilyAsync() => groups.GroupId is { } g
        ? nav.GoToAsync(Routes.FamilyForm, new Dictionary<string, object> { [Params.GroupId] = g })
        : Task.CompletedTask;
}
