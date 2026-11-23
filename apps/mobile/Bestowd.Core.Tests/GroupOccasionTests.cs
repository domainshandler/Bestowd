using System.Net;
using System.Text.Json;
using Bestowd.Core.Api;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;
using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

public class GroupOccasionTests
{
    private static readonly DateTime Now = new(2026, 11, 23, 12, 0, 0, DateTimeKind.Utc);

    private static FamilyListItem Fam(string id, string name, FamilyType type = FamilyType.Family) => new() { Id = id, Name = name, Type = type };

    private static Occasion Christmas() => new()
    {
        Id = "xmas", GroupId = "g1", Name = "Christmas", Scope = OccasionScope.Group, HolidayKey = "christmas", Type = OccasionType.Holiday,
        Currency = "CAD", RecursAnnually = true, NextOccurrence = new DateTime(2026, 12, 25, 0, 0, 0, DateTimeKind.Utc),
        Budget = 50, FamilyTypeBudgets = new() { ["SCHOOL"] = 20 }, IncludeNewFamilies = true,
        SubjectName = "2 families", EffectiveBudget = 70, Spent = 40,
        Coverage = new OccasionCoverage
        {
            FamilyCount = 2, CoveredCount = 1,
            Families =
            [
                new FamilyShare { FamilyId = "f1", Name = "Chen family", Type = FamilyType.Family, Budget = 50, Spent = 40, Covered = true },
                new FamilyShare { FamilyId = "f2", Name = "Ms Park", Type = FamilyType.School, Budget = 20, BudgetOverride = 20 },
            ],
        },
    };

    [Fact]
    public void Occasion_row_shows_coverage_and_opens_the_occasion_screen()
    {
        var item = OccasionItem.From(Christmas());
        Assert.StartsWith("1 of 2 families have a gift", item.Subtitle);
        Assert.Equal((Routes.GroupOccasion, "xmas"), item.Target);
    }

    [Fact]
    public void Screen_shows_progress_and_each_family()
    {
        var vm = new GroupOccasionViewModel(Fake.Api().Api, new FakeNavigator(), new FakePrompts(), new DataChanged());
        vm.SetData(Christmas(), Now);
        Assert.Equal("1 of 2", vm.ProgressText);
        Assert.StartsWith("Fri, Dec 25, 2026 · In 32 days · every year", vm.DateText);
        Assert.Equal("Bought", vm.Families[0].StatusText);
        Assert.True(vm.Families[1].NeedsGift);
        Assert.Contains("(just for them)", vm.Families[1].Line);
        Assert.StartsWith("School · Budget", vm.Families[1].Line);
    }

    [Fact]
    public async Task Logging_a_gift_for_a_family_prefills_the_family_and_occasion()
    {
        var nav = new FakeNavigator();
        var vm = new GroupOccasionViewModel(Fake.Api().Api, nav, new FakePrompts(), new DataChanged());
        vm.SetData(Christmas(), Now);
        await vm.LogGiftCommand.ExecuteAsync(vm.Families[1]);
        var (route, p) = nav.Visited.Single();
        Assert.Equal(Routes.LogGift, route);
        Assert.Equal("f2", p![Params.FamilyId]);
        Assert.Equal("xmas", p[Params.OccasionId]);
    }

    [Fact]
    public async Task Adding_a_holiday_offers_only_ones_not_yet_added_and_sends_ticked_families()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("POST /groups/g1/occasions", JsonSerializer.Serialize(Christmas(), ApiJson.Default.Occasion), HttpStatusCode.Created);
        var nav = new FakeNavigator();
        var vm = new GroupOccasionFormViewModel(api, new GroupState(new MemorySettingsStore()), nav, new DataChanged());
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1" });
        vm.SetData([Fam("f1", "Chen family"), Fam("f2", "Ms Park", FamilyType.School)], null,
        [
            new Holiday { Key = "christmas", Name = "Christmas", NextDate = new DateTime(2026, 12, 25), OccasionId = "already" },
            new Holiday { Key = "diwali", Name = "Diwali", Note = "Lakshmi Puja day", NextDate = new DateTime(2027, 10, 29, 0, 0, 0, DateTimeKind.Utc) },
        ]);

        Assert.Equal(["diwali", null], vm.Holidays.Select(h => h.Key));
        Assert.Equal("diwali", vm.Holiday!.Key);
        Assert.Equal("Lakshmi Puja day", vm.HolidayNote);
        Assert.False(vm.IsCustom);

        vm.Families[1].IsOn = false;
        vm.TypeBudgets.Single(t => t.Type == FamilyType.Neighbours).Text = "10";
        await vm.SaveCommand.ExecuteAsync(null);

        var body = JsonDocument.Parse(handler.Requests.Single(r => r.Method == HttpMethod.Post).Body!).RootElement;
        Assert.True(body.GetProperty("groupWide").GetBoolean());
        Assert.Equal("diwali", body.GetProperty("holidayKey").GetString());
        Assert.Equal(["f1"], body.GetProperty("familyIds").EnumerateArray().Select(e => e.GetString()));
        Assert.Equal(10, body.GetProperty("familyTypeBudgets").GetProperty("NEIGHBOURS").GetDecimal());
        Assert.False(body.TryGetProperty("name", out _));
        // No family has its own budget, so there's no second call.
        Assert.DoesNotContain(handler.Requests, r => r.Method == HttpMethod.Put);
        Assert.Equal(1, nav.BackCount);
    }

    [Fact]
    public async Task Your_own_occasion_needs_a_name_and_sends_its_date()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("POST /groups/g1/occasions", JsonSerializer.Serialize(Christmas(), ApiJson.Default.Occasion), HttpStatusCode.Created);
        var vm = new GroupOccasionFormViewModel(api, new GroupState(new MemorySettingsStore()), new FakeNavigator(), new DataChanged());
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1" });
        vm.SetData([Fam("f1", "Chen family")], null, []);
        Assert.True(vm.IsCustom);
        Assert.False(vm.SaveCommand.CanExecute(null));

        vm.Name = "Teacher appreciation";
        vm.Date = new DateTime(2027, 5, 4);
        await vm.SaveCommand.ExecuteAsync(null);
        var body = JsonDocument.Parse(handler.Last.Body!).RootElement;
        Assert.Equal("Teacher appreciation", body.GetProperty("name").GetString());
        Assert.Equal("2027-05-04", body.GetProperty("date").GetString());
        Assert.Equal("HOLIDAY", body.GetProperty("type").GetString());
    }

    [Fact]
    public async Task Editing_saves_budgets_then_the_families_with_their_own_budgets()
    {
        var (api, handler, _) = Fake.Api();
        var json = JsonSerializer.Serialize(Christmas(), ApiJson.Default.Occasion);
        handler.On("PATCH /occasions/xmas", json).On("PUT /occasions/xmas/families", json);
        var vm = new GroupOccasionFormViewModel(api, new GroupState(new MemorySettingsStore()), new FakeNavigator(), new DataChanged());
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1", [Params.Id] = "xmas" });
        vm.SetData([Fam("f1", "Chen family"), Fam("f2", "Ms Park", FamilyType.School), Fam("f3", "Next door", FamilyType.Neighbours)], Christmas(), []);

        Assert.True(vm.IsEditing);
        Assert.Equal("50", vm.Budget);
        Assert.Equal("20", vm.TypeBudgets.Single(t => t.Type == FamilyType.School).Text);
        Assert.Equal([true, true, false], vm.Families.Select(f => f.IsOn));
        Assert.Equal("20", vm.Families[1].Budget);

        vm.Families[2].IsOn = true;
        vm.Families[0].Budget = "120";
        await vm.SaveCommand.ExecuteAsync(null);

        var patch = JsonDocument.Parse(handler.Requests.Single(r => r.Method == HttpMethod.Patch).Body!).RootElement;
        Assert.Equal(50, patch.GetProperty("budget").GetDecimal());
        Assert.Equal(20, patch.GetProperty("familyTypeBudgets").GetProperty("SCHOOL").GetDecimal());
        var put = JsonDocument.Parse(handler.Requests.Single(r => r.Method == HttpMethod.Put).Body!).RootElement.GetProperty("families");
        Assert.Equal(["f1", "f2", "f3"], put.EnumerateArray().Select(f => f.GetProperty("familyId").GetString()));
        Assert.Equal(120, put[0].GetProperty("budget").GetDecimal());
        Assert.False(put[2].TryGetProperty("budget", out _));
    }

    [Fact]
    public void A_bad_budget_is_a_form_error()
    {
        var vm = new GroupOccasionFormViewModel(Fake.Api().Api, new GroupState(new MemorySettingsStore()), new FakeNavigator(), new DataChanged());
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1" });
        vm.SetData([Fam("f1", "Chen family")], null, [new Holiday { Key = "easter", Name = "Easter", NextDate = new DateTime(2027, 3, 28) }]);
        vm.Budget = "lots";
        Assert.Null(vm.BuildCreateBody());
        Assert.NotNull(vm.Error);
    }
}
