using Bestowd.Core.Formatting;
using Bestowd.Core.Models;
using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

public class PickerTests
{
    private static PersonListItem P(string id, string name, string family) => new() { Id = id, Name = name, FamilyName = family };
    private static readonly List<PersonListItem> People =
    [
        P("1", "Mia", "Smiths"), P("2", "Amelia", "Chen family"), P("3", "Leo", "Smiths"), P("4", "Zoë", "Park"), P("5", "Liam", "Park"),
    ];

    private static readonly List<FamilyListItem> Families = [new() { Id = "s", Name = "Smiths" }, new() { Id = "k", Name = "Park" }];
    private static List<SubjectOption> Options(bool families = false) => SubjectOption.Build(People, families ? Families : []);

    [Fact]
    public void Finds_by_name_or_family_ignoring_case_and_accents_prefix_first()
    {
        string[] Names(string q, IEnumerable<SubjectOption>? exclude = null, bool families = false) =>
            RecipientPicker.Find(Options(families), q, exclude ?? []).Select(o => o.DisplayName).ToArray();
        Assert.Equal(["Mia"], Names("mi"));
        Assert.Equal(["Amelia"], Names("AM"));
        Assert.Equal(["Zoë"], Names("zoe"));
        Assert.Equal(["Leo", "Mia"], Names("smith"));
        Assert.Equal(["Smiths", "Leo", "Mia"], Names("smith", families: true));
        Assert.Empty(Names("  "));
        Assert.Empty(Names("mi", Options().Where(o => o.PersonId == "1")));
    }

    [Fact]
    public void Adding_clears_the_search_and_removes_the_person_from_matches()
    {
        var picker = new RecipientPicker();
        var options = Options(families: true);
        picker.SetOptions(options, options.Where(o => o.PersonId == "3"));
        Assert.Equal(["3"], picker.ChosenPersonIds);

        picker.Search = "park";
        Assert.Equal(["Liam", "Zoë"], picker.Matches.Select(m => m.DisplayName));
        picker.AddCommand.Execute(picker.Matches[1]);
        Assert.Equal("", picker.Search);
        Assert.Equal(["3", "4"], picker.ChosenPersonIds);

        picker.Search = "park";
        Assert.Equal(["Liam"], picker.Matches.Select(m => m.DisplayName));
        Assert.False(picker.CanAddNew); // no AddNew set

        picker.RemoveCommand.Execute(picker.Chosen[0]);
        Assert.Equal(["4"], picker.ChosenPersonIds);
    }

    [Fact]
    public async Task Single_choice_replaces_and_adding_someone_new_chooses_them()
    {
        var picker = new RecipientPicker(includeFamilies: true, single: true);
        var changes = 0;
        picker.Changed += (_, _) => changes++;
        picker.SetOptions(Options(families: true));
        picker.Search = "park";
        picker.AddCommand.Execute(picker.Matches.First(m => m.FamilyId == "k"));
        Assert.False(picker.ShowSearch);
        Assert.Equal("Park · family", picker.Chosen.Single().ChipText);

        picker.RemoveCommand.Execute(picker.Chosen[0]);
        picker.AddNew = name => Task.FromResult<SubjectOption?>(new SubjectOption(name, "new", null, name, "Nora's family"));
        picker.Search = "Nora";
        Assert.True(picker.CanAddNew);
        Assert.Equal("+ Add “Nora”", picker.AddLabel);
        await picker.AddNewCommand.ExecuteAsync(null);
        Assert.Equal("new", picker.Chosen.Single().PersonId);
        Assert.Equal(3, changes);
    }

    [Fact]
    public void Currency_list_keeps_an_unlisted_current_currency()
    {
        Assert.Equal(Currencies.All, Currencies.WithCurrent("CAD"));
        Assert.Equal("ISK", Currencies.WithCurrent("ISK")[^1].Code);
        Assert.Equal(Currencies.All.Count, Currencies.All.Select(c => c.Code).Distinct().Count());
    }
}
