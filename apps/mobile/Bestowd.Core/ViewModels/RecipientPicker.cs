using System.Collections.ObjectModel;
using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>
/// Choosing people (and, when allowed, whole families) by typing: matches narrow as you type, chosen ones
/// show as removable chips, and "+ Add" creates someone who isn't in Bestowd yet. With <c>single</c>,
/// choosing replaces the current choice and the search hides until it's removed.
/// </summary>
public sealed partial class RecipientPicker(bool includeFamilies = false, bool single = false) : ObservableObject
{
    public const int MaxMatches = 8;
    private IReadOnlyList<SubjectOption> _all = [];

    [ObservableProperty] public partial string Search { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyList<SubjectOption> Matches { get; private set; } = [];

    public bool IncludesFamilies => includeFamilies;
    public bool Single => single;
    public ObservableCollection<SubjectOption> Chosen { get; } = [];
    public bool HasChosen => Chosen.Count > 0;
    public bool ShowSearch => !single || Chosen.Count == 0;
    public bool CanAddNew => AddNew is not null && Search.Trim().Length > 0;
    public string AddLabel => $"+ Add “{Search.Trim()}”";
    public string Placeholder => includeFamilies ? "Search people or families" : "Search people";

    /// <summary>Creates someone new from the typed name; null when cancelled. Set by the screen.</summary>
    public Func<string, Task<SubjectOption?>>? AddNew { get; set; }

    /// <summary>Raised when the choice changes.</summary>
    public event EventHandler? Changed;

    public IEnumerable<string> ChosenPersonIds => Chosen.Where(c => c.PersonId is not null).Select(c => c.PersonId!);

    public void SetOptions(IReadOnlyList<SubjectOption> options, IEnumerable<SubjectOption>? chosen = null)
    {
        _all = includeFamilies ? options : options.Where(o => o.PersonId is not null).ToList();
        if (chosen is not null)
        {
            Chosen.Clear();
            foreach (var c in chosen)
                if (_all.FirstOrDefault(o => o.PersonId == c.PersonId && o.FamilyId == c.FamilyId) is { } match) Chosen.Add(match);
        }
        Refresh();
    }

    /// <summary>Sets the choice without raising <see cref="Changed"/> (for screens syncing their own state).</summary>
    public void SetChosen(SubjectOption? option)
    {
        Chosen.Clear();
        if (option is not null) Chosen.Add(_all.FirstOrDefault(o => o.PersonId == option.PersonId && o.FamilyId == option.FamilyId) ?? option);
        Refresh();
    }

    partial void OnSearchChanged(string value) => Refresh();

    /// <summary>People (and families) with a word in their name, or a person's family, starting with the search, ignoring case and accents.</summary>
    public static IReadOnlyList<SubjectOption> Find(IEnumerable<SubjectOption> options, string search, IEnumerable<SubjectOption> exclude)
    {
        var q = search.Trim();
        if (q.Length == 0) return [];
        var skip = exclude.Select(e => (e.PersonId, e.FamilyId)).ToHashSet();
        var compare = CultureInfo.InvariantCulture.CompareInfo;
        const CompareOptions opts = CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace;
        return options
            .Where(o => !skip.Contains((o.PersonId, o.FamilyId)) && (WordStarts(o.DisplayName, q) || (o.PersonId is not null && WordStarts(o.Detail ?? "", q))))
            .OrderBy(o => compare.IsPrefix(o.DisplayName, q, opts) ? 0 : 1).ThenBy(o => o.DisplayName, StringComparer.CurrentCultureIgnoreCase)
            .Take(MaxMatches)
            .ToList();
    }

    private static bool WordStarts(string text, string query) =>
        text.Split([' ', '-', '\''], StringSplitOptions.RemoveEmptyEntries)
            .Any(w => CultureInfo.InvariantCulture.CompareInfo.IsPrefix(w, query, CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace));

    private void Refresh()
    {
        Matches = Find(_all, Search, Chosen);
        foreach (var name in new[] { nameof(HasChosen), nameof(ShowSearch), nameof(CanAddNew), nameof(AddLabel) }) OnPropertyChanged(name);
    }

    [RelayCommand]
    public void Add(SubjectOption pick)
    {
        if (single) Chosen.Clear();
        if (!Chosen.Any(c => c.PersonId == pick.PersonId && c.FamilyId == pick.FamilyId)) Chosen.Add(pick);
        Search = "";
        Refresh();
        Changed?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    public void Remove(SubjectOption pick)
    {
        Chosen.Remove(pick);
        Refresh();
        Changed?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    public async Task AddNewAsync()
    {
        if (AddNew is null || Search.Trim() is not { Length: > 0 } name) return;
        if (await AddNew(name) is not { } created) return;
        _all = [.. _all, created];
        Add(created);
    }
}

/// <summary>Adds someone who isn't in Bestowd yet, from a form's picker: a person in a family, or a whole family.</summary>
public sealed class QuickAdd(BestowdApi api, IPrompts prompts)
{
    public const string NewFamily = "A new family";
    public const string WholeFamily = "As a whole family";

    public async Task<SubjectOption?> AddAsync(string groupId, string name, bool allowFamily)
    {
        var families = await api.ListFamiliesAsync(groupId);
        var options = new List<string> { NewFamily };
        if (families.FirstOrDefault(f => f.IsOwnHousehold) is { } home) options.Add($"{home.Name} (your household)");
        options.AddRange(families.Where(f => !f.IsOwnHousehold).Select(f => f.Name));
        if (allowFamily) options.Add(WholeFamily);
        var choice = await prompts.ChooseAsync($"Add {name} to…", options);
        if (choice is null) return null;

        if (choice == WholeFamily)
        {
            var family = await api.CreateFamilyAsync(groupId, new CreateFamilyBody { Name = name });
            return new SubjectOption($"{family.Name} (whole family)", null, family.Id, family.Name, "Whole family");
        }
        string familyId, familyName;
        if (choice == NewFamily)
        {
            var familyText = await prompts.AskTextAsync("Their family", $"What should {name}'s family be called?", $"{name}'s family");
            if (familyText is null) return null;
            familyName = string.IsNullOrWhiteSpace(familyText) ? $"{name}'s family" : familyText.Trim();
            familyId = (await api.CreateFamilyAsync(groupId, new CreateFamilyBody { Name = familyName })).Id;
        }
        else
        {
            var family = families.First(f => choice.StartsWith(f.Name, StringComparison.Ordinal));
            (familyId, familyName) = (family.Id, family.Name);
        }
        var person = await api.CreatePersonAsync(familyId, new PersonBody { Name = name });
        return new SubjectOption($"{person.Name} ({familyName})", person.Id, null, person.Name, familyName);
    }
}
