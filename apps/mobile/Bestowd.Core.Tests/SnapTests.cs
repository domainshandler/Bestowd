using System.Text.Json;
using Bestowd.Core.Api;
using Bestowd.Core.Auth;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;
using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

/// <summary>Photo first on Home, editing ideas, and buying an idea nobody is tagged in.</summary>
public class SnapTests
{
    private sealed class FakePhotos(byte[]? photo) : IPhotoSource
    {
        public Task<byte[]?> TakeAsync() => Task.FromResult(photo);
        public Task<byte[]?> ChooseAsync() => Task.FromResult(photo);
    }

    private const string Lamp = """
    {"id":"lamp","groupId":"g1","title":"Reading lamp","brand":"IKEA","store":"IKEA","category":"Home","url":"https://shop/lamp","imageUrl":"/files/g1/lamp.jpg?sig=z",
     "price":40,"notes":"For the reading nook","ageMin":null,"ageMax":null,"status":"SAVED","occasionId":null,"people":[],"createdById":"u1",
     "createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z","repeat":null}
    """;

    private static GroupState Group()
    {
        var state = new GroupState(new MemorySettingsStore());
        state.Load(new Me { PrimaryGroupId = "g1", Memberships = [new Membership { GroupId = "g1", GroupName = "Mine", Role = MembershipRole.Member }] });
        return state;
    }

    private static FakeHandler People(FakeHandler h) => h
        .On("GET /groups/g1/people", JsonSerializer.Serialize(new List<PersonListItem> { new() { Id = "p1", Name = "Mia", FamilyId = "f1", FamilyName = "Smiths" } }, ApiJson.Default.ListPersonListItem))
        .On("GET /groups/g1/families", JsonSerializer.Serialize(new List<FamilyListItem> { new() { Id = "f1", Name = "Smiths" } }, ApiJson.Default.ListFamilyListItem))
        .On("GET /groups/g1/occasions", JsonSerializer.Serialize(new GroupOccasions(), ApiJson.Default.GroupOccasions));

    [Theory]
    [InlineData(HomeViewModel.AsIdea, Routes.IdeaForm, null)]
    [InlineData(HomeViewModel.AsGiven, Routes.LogGift, null)]
    [InlineData(HomeViewModel.AsReceived, Routes.LogGift, "RECEIVED")]
    public async Task Snapping_uploads_first_then_opens_the_chosen_form_with_the_photo(string choice, string route, string? direction)
    {
        var (api, handler, _) = Fake.Api();
        handler.On("POST /groups/g1/photos", """{"url":"/files/g1/tag.jpg?sig=x"}""");
        var nav = new FakeNavigator();
        var prompts = new FakePrompts { Choice = choice };
        var vm = new HomeViewModel(api, nav, Group(), new DataChanged(), new FakePhotos([0xff, 0xd8, 0xff, 1]), prompts);
        Assert.True(vm.CanSnap);

        await vm.SnapCommand.ExecuteAsync(null);
        Assert.Equal(["What is it?"], prompts.Asked);
        var (visited, p) = Assert.Single(nav.Visited);
        Assert.Equal(route, visited);
        Assert.Equal("/files/g1/tag.jpg?sig=x", p![Params.PhotoUrl]);
        Assert.Equal(direction, p.TryGetValue(Params.Direction, out var d) ? d : null);
    }

    [Fact]
    public async Task Cancelling_the_camera_or_the_question_goes_nowhere_and_without_a_camera_there_is_no_snap()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("POST /groups/g1/photos", """{"url":"/files/g1/tag.jpg?sig=x"}""");
        var nav = new FakeNavigator();
        await new HomeViewModel(api, nav, Group(), new DataChanged(), new FakePhotos(null), new FakePrompts()).SnapCommand.ExecuteAsync(null);
        Assert.Empty(handler.Requests);
        await new HomeViewModel(api, nav, Group(), new DataChanged(), new FakePhotos([1]), new FakePrompts { Choice = null }).SnapCommand.ExecuteAsync(null);
        Assert.Empty(nav.Visited);
        Assert.False(new HomeViewModel(api, nav, Group(), new DataChanged()).CanSnap);
    }

    [Fact]
    public async Task A_form_opened_from_a_photo_reads_it_once_when_the_group_has_AI()
    {
        var (api, handler, _) = Fake.Api();
        People(handler)
            .On("GET /groups/g1/ai", """{"provider":"anthropic","configured":true}""")
            .On("POST /groups/g1/capture/photo", """{"draft":{"title":"Forerunner 165","brand":"Garmin","price":329.99,"currency":"CAD","store":null,"url":null,"imageUrl":null}}""");
        var vm = new IdeaFormViewModel(api, new FakeNavigator(), new DataChanged());
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1", [Params.PhotoUrl] = "/files/g1/tag.jpg?sig=x" });
        Assert.True(vm.FromPhoto);

        await vm.LoadAsync();
        await vm.LoadAsync();
        Assert.Equal(("Forerunner 165", "Garmin"), (vm.Title, vm.Brand));
        Assert.Equal("/files/g1/tag.jpg?sig=x", vm.Photo.Url);
        Assert.Single(handler.Requests, r => r.PathAndQuery == "/groups/g1/capture/photo");
    }

    [Fact]
    public async Task Editing_an_idea_loads_it_and_saves_a_patch()
    {
        var (api, handler, _) = Fake.Api();
        People(handler).On("GET /ideas/lamp", Lamp).On("PATCH /ideas/lamp", Lamp).On("GET /groups/g1/ai", """{"configured":false}""");
        var nav = new FakeNavigator();
        var vm = new IdeaFormViewModel(api, nav, new DataChanged());
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1", [Params.Id] = "lamp" });
        Assert.Equal("Edit idea", vm.ScreenTitle);

        await vm.LoadAsync();
        Assert.Equal(("Reading lamp", "IKEA", "For the reading nook"), (vm.Title, vm.Brand, vm.Notes));
        vm.Title = "Desk lamp";
        await vm.SaveCommand.ExecuteAsync(null);

        var patch = handler.Requests.Single(r => r.Method == HttpMethod.Patch);
        Assert.Contains("\"title\":\"Desk lamp\"", patch.Body);
        Assert.Contains("\"personIds\":[]", patch.Body);
        Assert.Equal(1, nav.BackCount);
    }

    [Fact]
    public async Task Buying_an_idea_nobody_is_tagged_in_opens_log_a_gift_from_the_idea_and_saving_sends_it()
    {
        var groups = Group();
        var (api, handler, _) = Fake.Api();
        var nav = new FakeNavigator();
        var ideas = new IdeasViewModel(api, groups, nav, new DataChanged());
        var lamp = JsonSerializer.Deserialize(Lamp, ApiJson.Default.Idea)!;
        ideas.SetData(new IdeaList { Ideas = [lamp] }, null, "CAD");

        await ideas.BuyCommand.ExecuteAsync(ideas.Ideas[0]);
        Assert.DoesNotContain(handler.Requests, r => r.PathAndQuery.EndsWith("/buy", StringComparison.Ordinal));
        var (route, p) = Assert.Single(nav.Visited);
        Assert.Equal(Routes.LogGift, route);
        Assert.Equal("lamp", p![Params.IdeaId]);

        People(handler).On("GET /ideas/lamp", Lamp).On("GET /groups/g1/ai", """{"configured":false}""").On("POST /groups/g1/gifts", "{}");
        var session = new Session(api, new MemoryTokenStore(), groups, new NoPush(), new MemorySettingsStore());
        var form = new LogGiftViewModel(api, groups, session, new FakeNavigator(), new DataChanged());
        form.Apply(p);
        await form.LoadAsync();
        Assert.Equal(("Reading lamp", "IKEA", "/files/g1/lamp.jpg?sig=z"), (form.Title, form.Brand, form.Photo.Url));
        Assert.True(form.BoughtNotGiven);
        Assert.Null(form.Subject);
        form.Subject = form.Subjects.First(s => s.PersonId == "p1");
        await form.SaveCommand.ExecuteAsync(null);
        var post = handler.Requests.Single(r => r.Method == HttpMethod.Post && r.PathAndQuery == "/groups/g1/gifts");
        Assert.Contains("\"ideaId\":\"lamp\"", post.Body);
        Assert.Contains("\"status\":\"BOUGHT\"", post.Body);
    }

    [Fact]
    public async Task Edit_opens_the_idea_form_for_that_idea()
    {
        var nav = new FakeNavigator();
        var ideas = new IdeasViewModel(Fake.Api().Api, Group(), nav, new DataChanged());
        ideas.SetData(new IdeaList { Ideas = [new Idea { Id = "kit", Title = "Kit" }] }, null, "CAD");
        await ideas.EditCommand.ExecuteAsync(ideas.Ideas[0]);
        Assert.Equal((Routes.IdeaForm, "kit"), (nav.Visited[0].Route, nav.Visited[0].Parameters![Params.Id]));
    }
}
