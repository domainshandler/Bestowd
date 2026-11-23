using System.Text.Json;
using Bestowd.Core.Api;
using Bestowd.Core.Auth;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;
using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

public class LogGiftOccasionTests
{
    private static readonly Occasion Christmas = new() { Id = "xmas", GroupId = "g1", Name = "Christmas", Scope = OccasionScope.Group };
    private static readonly Occasion MiaBirthday = new() { Id = "bday", GroupId = "g1", Name = "Mia's birthday", PersonId = "p1" };

    private static (LogGiftViewModel Vm, FakeHandler Handler) Make(params Occasion[] occasions)
    {
        var groups = new GroupState(new MemorySettingsStore());
        var (api, handler, _) = Fake.Api();
        handler
            .On("GET /groups/g1/people", JsonSerializer.Serialize(new List<PersonListItem> { new() { Id = "p1", Name = "Mia", FamilyId = "f1", FamilyName = "Smiths" } }, ApiJson.Default.ListPersonListItem))
            .On("GET /groups/g1/families", JsonSerializer.Serialize(new List<FamilyListItem> { new() { Id = "f1", Name = "Smiths" } }, ApiJson.Default.ListFamilyListItem))
            .On("GET /groups/g1/occasions", JsonSerializer.Serialize(new GroupOccasions { Occasions = [.. occasions] }, ApiJson.Default.GroupOccasions));
        var session = new Session(api, new MemoryTokenStore(), groups, new NoPush(), new MemorySettingsStore());
        return (new LogGiftViewModel(api, groups, session, new FakeNavigator(), new DataChanged()), handler);
    }

    [Fact]
    public async Task With_nobody_chosen_it_lists_every_occasion_in_the_group()
    {
        var (vm, handler) = Make(Christmas, MiaBirthday);
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1" });
        await vm.LoadAsync();
        Assert.Null(vm.Subject);
        Assert.Equal(["xmas", "bday"], vm.Occasions.Select(o => o.Id));
        var query = handler.Requests.Last(r => r.PathAndQuery.StartsWith("/groups/g1/occasions")).PathAndQuery;
        Assert.DoesNotContain("personId", query);
        Assert.DoesNotContain("familyId", query);
    }

    [Fact]
    public async Task Prefilled_family_and_occasion_are_both_selected()
    {
        // Log gift from a holiday's screen: the family and the occasion come in as parameters.
        var (vm, handler) = Make(Christmas);
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1", [Params.FamilyId] = "f1", [Params.OccasionId] = "xmas" });
        await vm.LoadAsync();
        Assert.Equal("f1", vm.Subject?.FamilyId);
        Assert.Equal("xmas", vm.Occasion?.Id);
        Assert.Contains("familyId=f1", handler.Requests.Last(r => r.PathAndQuery.StartsWith("/groups/g1/occasions")).PathAndQuery);
    }

    [Fact]
    public async Task Picking_an_occasion_for_one_person_fills_in_who()
    {
        var (vm, _) = Make(Christmas, MiaBirthday);
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1" });
        await vm.LoadAsync();
        vm.Occasion = vm.Occasions.Single(o => o.Id == "bday");
        Assert.Equal("p1", vm.Subject?.PersonId);

        // A group-wide occasion leaves the choice of who to you.
        var (other, _) = Make(Christmas);
        other.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1" });
        await other.LoadAsync();
        other.Occasion = other.Occasions.Single();
        Assert.Null(other.Subject);
    }
}
