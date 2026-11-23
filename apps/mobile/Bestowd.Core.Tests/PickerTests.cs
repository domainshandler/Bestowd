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

    [Fact]
    public void Finds_by_name_or_family_ignoring_case_and_accents_prefix_first()
    {
        Assert.Equal(["Mia"], PeoplePicker.Find(People, "mi", []).Select(p => p.Name));
        Assert.Equal(["Amelia"], PeoplePicker.Find(People, "AM", []).Select(p => p.Name));
        Assert.Equal(["Zoë"], PeoplePicker.Find(People, "zoe", []).Select(p => p.Name));
        Assert.Equal(["Leo", "Mia"], PeoplePicker.Find(People, "smith", []).Select(p => p.Name));
        Assert.Empty(PeoplePicker.Find(People, "  ", []));
        Assert.Empty(PeoplePicker.Find(People, "mi", ["1"]));
    }

    [Fact]
    public void Adding_clears_the_search_and_removes_the_person_from_matches()
    {
        var picker = new PeoplePicker();
        picker.SetPeople(People, ["3"]);
        Assert.Equal(["3"], picker.ChosenIds);

        picker.Search = "park";
        Assert.Equal(["Liam", "Zoë"], picker.Matches.Select(m => m.Person.Name));
        picker.AddCommand.Execute(picker.Matches[1]);
        Assert.Equal("", picker.Search);
        Assert.Equal(["3", "4"], picker.ChosenIds);

        picker.Search = "park";
        Assert.Equal(["Liam"], picker.Matches.Select(m => m.Person.Name));
        picker.Search = "nobody";
        Assert.True(picker.NoMatches);

        picker.RemoveCommand.Execute(picker.Chosen[0]);
        Assert.Equal(["4"], picker.ChosenIds);
    }

    [Fact]
    public void Currency_list_keeps_an_unlisted_current_currency()
    {
        Assert.Equal(Currencies.All, Currencies.WithCurrent("CAD"));
        Assert.Equal("ISK", Currencies.WithCurrent("ISK")[^1].Code);
        Assert.Equal(Currencies.All.Count, Currencies.All.Select(c => c.Code).Distinct().Count());
    }
}
