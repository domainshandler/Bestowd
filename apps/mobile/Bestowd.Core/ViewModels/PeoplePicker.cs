using System.Collections.ObjectModel;
using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>A person shown as a search match or a chosen chip: "Mia (Smiths)".</summary>
public sealed record PersonPick(PersonListItem Person)
{
    public string Label => $"{Person.Name} ({Person.FamilyName})";
}

/// <summary>Choosing several people by searching their name (or family) instead of toggling a long list.</summary>
public sealed partial class PeoplePicker : ObservableObject
{
    public const int MaxMatches = 8;
    private IReadOnlyList<PersonListItem> _all = [];

    [ObservableProperty] public partial string Search { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyList<PersonPick> Matches { get; private set; } = [];

    public ObservableCollection<PersonPick> Chosen { get; } = [];
    public bool HasChosen => Chosen.Count > 0;
    public bool NoMatches => Search.Trim().Length > 0 && Matches.Count == 0;

    public IEnumerable<string> ChosenIds => Chosen.Select(c => c.Person.Id);

    public void SetPeople(IReadOnlyList<PersonListItem> people, IEnumerable<string> chosenIds)
    {
        _all = people;
        Chosen.Clear();
        foreach (var id in chosenIds)
            if (people.FirstOrDefault(p => p.Id == id) is { } p) Chosen.Add(new PersonPick(p));
        Refresh();
    }

    partial void OnSearchChanged(string value) => Refresh();

    /// <summary>People with a word in their name or family starting with the search (ignoring case and accents), not already chosen.</summary>
    public static IReadOnlyList<PersonListItem> Find(IEnumerable<PersonListItem> people, string search, IEnumerable<string> exclude)
    {
        var q = search.Trim();
        if (q.Length == 0) return [];
        var skip = exclude.ToHashSet();
        var compare = CultureInfo.InvariantCulture.CompareInfo;
        const CompareOptions opts = CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace;
        return people
            .Where(p => !skip.Contains(p.Id) && (WordStarts(p.Name, q) || WordStarts(p.FamilyName, q)))
            .OrderBy(p => compare.IsPrefix(p.Name, q, opts) ? 0 : 1).ThenBy(p => p.Name, StringComparer.CurrentCultureIgnoreCase)
            .Take(MaxMatches)
            .ToList();
    }

    private static bool WordStarts(string text, string query) =>
        text.Split([' ', '-', '\''], StringSplitOptions.RemoveEmptyEntries)
            .Any(w => CultureInfo.InvariantCulture.CompareInfo.IsPrefix(w, query, CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace));

    private void Refresh()
    {
        Matches = Find(_all, Search, ChosenIds).Select(p => new PersonPick(p)).ToList();
        OnPropertyChanged(nameof(HasChosen));
        OnPropertyChanged(nameof(NoMatches));
    }

    [RelayCommand]
    public void Add(PersonPick pick)
    {
        if (Chosen.All(c => c.Person.Id != pick.Person.Id)) Chosen.Add(pick);
        Search = "";
        Refresh();
    }

    [RelayCommand]
    public void Remove(PersonPick pick)
    {
        Chosen.Remove(pick);
        Refresh();
    }
}
