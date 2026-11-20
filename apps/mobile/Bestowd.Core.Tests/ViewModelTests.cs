using System.Text.Json;
using Bestowd.Core.Auth;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;
using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

public class ViewModelTests
{
    private static Occasion Occ(string name, OccasionStatus status = OccasionStatus.NotStarted, string group = "Mine", decimal? budget = 40, decimal spent = 0) => new()
    {
        Id = name, Name = name, Status = status, GroupName = group, Currency = "CAD", PersonId = "p1",
        SubjectName = "Maya", SubjectFamilyName = "Chen family", EffectiveBudget = budget, Spent = spent,
        NextOccurrence = new DateTime(2026, 11, 22, 0, 0, 0, DateTimeKind.Utc),
    };

    private static Gift G(string id, GiftDirection dir = GiftDirection.Given, string? occasion = null, int year = 2026, decimal? amount = 45, bool hidden = false, bool thanked = false, GiftStatus? status = GiftStatus.Given) => new()
    {
        Id = id, Title = id, Direction = dir, OccasionName = occasion, CounterpartyName = "Maya", Amount = amount,
        ValueHidden = hidden, ThankYouSent = thanked, Status = dir == GiftDirection.Given ? status : null,
        Date = new DateTime(year, 3, 9, 0, 0, 0, DateTimeKind.Utc),
        OccasionDate = occasion is null ? null : new DateTime(year, 12, 25, 0, 0, 0, DateTimeKind.Utc),
    };

    private static Occasion BirthdayOcc() => new()
    {
        Id = "Maya's birthday", Name = "Maya's birthday", Type = OccasionType.Birthday, PersonId = "p1", Currency = "CAD", EffectiveBudget = 40,
        NextOccurrence = new DateTime(2026, 11, 22, 0, 0, 0, DateTimeKind.Utc),
    };

    [Fact]
    public void Home_summarises_count_needs_and_planned_spend_and_labels_groups_only_when_several()
    {
        var vm = new HomeViewModel(Fake.Api().Api, new FakeNavigator());
        vm.Apply(new HomeOccasions
        {
            Occasions = [Occ("Maya's birthday"), Occ("Christmas", OccasionStatus.IdeaSaved, budget: null)],
            PlannedSpend = [new CurrencyAmount { Currency = "CAD", Amount = 40 }],
            MultipleGroups = false,
        });
        Assert.Equal("2 occasions in the next 30 days", vm.Headline);
        Assert.Equal("1 need a gift", vm.NeedGiftsText);
        Assert.NotNull(vm.PlannedText);
        Assert.Equal("Needs gift", vm.Occasions[0].StatusText);
        Assert.Equal(Tone.Amber, vm.Occasions[0].StatusTone);
        Assert.Equal("NOV", vm.Occasions[0].Month);
        Assert.DoesNotContain("Mine", vm.Occasions[0].Subtitle);

        vm.Apply(new HomeOccasions { Occasions = [Occ("Leo", group: "Sam's group")], MultipleGroups = true });
        Assert.Contains("Sam's group", vm.Occasions[0].Subtitle);
        Assert.Null(vm.NeedGiftsText is null ? null : vm.PlannedText);
    }

    [Fact]
    public void Occasion_items_open_the_person_else_the_family_and_show_spend_of_budget()
    {
        var item = OccasionItem.From(Occ("x", spent: 25));
        Assert.Equal((Routes.Person, "p1"), item.Target);
        Assert.Contains("of", item.Subtitle);

        var family = OccasionItem.From(new Occasion { Id = "o", Name = "Diwali", FamilyId = "f1", SubjectName = "Patel family", Date = DateTime.UtcNow });
        Assert.Equal((Routes.Family, "f1"), family.Target);
        Assert.Equal("Patel family", family.Subtitle);
    }

    [Fact]
    public void Gifts_group_by_occasion_and_year_and_hide_received_values()
    {
        var sections = GiftGrouping.ByOccasionAndYear(
            [G("a", occasion: "Christmas", year: 2025), G("b", occasion: "Christmas", year: 2025), G("c", year: 2026),
             G("r", GiftDirection.Received, amount: 30, hidden: true)], "CAD");
        Assert.Equal(["Christmas · 2025", "Other gifts · 2026"], sections.Select(s => s.Title));
        Assert.Equal(2, sections[0].Items.Count);

        var hidden = sections[1].Items.Single(i => i.Gift.Id == "r");
        Assert.True(hidden.ShowReveal);
        Assert.Null(hidden.AmountText);
        Assert.Equal("Thank-you due", hidden.BadgeText);
        Assert.True(hidden.CanMarkThanked);

        var shown = GiftItem.From(G("r2", GiftDirection.Received, hidden: false, thanked: true), "CAD");
        Assert.False(shown.ShowReveal);
        Assert.NotNull(shown.AmountText);
        Assert.Equal("Thanked", shown.BadgeText);
        Assert.StartsWith("From Maya", shown.Line);
    }

    [Fact]
    public void Gifts_planned_filter_means_bought_but_not_given()
    {
        Assert.Equal((GiftDirection.Given, GiftStatus.Bought), GiftsViewModel.QueryFor(GiftFilter.Planned));
        Assert.Equal((GiftDirection.Received, (GiftStatus?)null), GiftsViewModel.QueryFor(GiftFilter.Received));
        Assert.Equal(((GiftDirection?)null, (GiftStatus?)null), GiftsViewModel.QueryFor(GiftFilter.All));
    }

    [Fact]
    public async Task Gifts_reveal_patches_value_hidden_false()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("PATCH /gifts/r", """{"id":"r","direction":"RECEIVED","title":"x","date":"2026-01-01T00:00:00Z","credits":[]}""");
        var groups = new GroupState(new MemorySettingsStore());
        var vm = new GiftsViewModel(api, groups, new FakeNavigator(), new DataChanged());

        await vm.RevealAsync(GiftItem.From(G("r", GiftDirection.Received, hidden: true), "CAD"));

        var patch = handler.Requests.Single(r => r.Method == HttpMethod.Patch);
        Assert.Equal("""{"valueHidden":false}""", patch.Body);
    }

    [Fact]
    public void Ideas_pick_the_first_non_repeat_and_explain_repeats()
    {
        var vm = new IdeasViewModel(Fake.Api().Api, new GroupState(new MemorySettingsStore()), new FakeNavigator(), new DataChanged());
        vm.Selected = new PersonChoice("p1", "For Maya");
        var puzzle = new Idea { Id = "puzzle", Title = "Floor puzzle", Category = "Puzzle", Repeat = new Repeat { Title = "48 pc", Date = new DateTime(2025, 12, 25, 0, 0, 0, DateTimeKind.Utc) } };
        var kit = new Idea { Id = "kit", Title = "Watercolour kit", Price = 35, People = [new PersonRef { Id = "p1", Name = "Maya" }] };

        vm.SetData(new IdeaList { Person = new IdeaPerson { Id = "p1", Name = "Maya", Age = 5 }, Ideas = [puzzle, kit] }, BirthdayOcc(), "CAD");

        Assert.False(vm.Ideas[0].IsTopPick);
        Assert.True(vm.Ideas[1].IsTopPick);
        Assert.Equal("Puzzle: you gave one in Dec 2025", vm.RepeatNotice);
        Assert.StartsWith("Turning 5 · Maya's birthday · Nov 22", vm.Header);
        Assert.Equal("For Maya", vm.Ideas[1].Meta);

        var body = vm.BuyBodyFor(kit);
        Assert.Equal("p1", body.PersonId);
        Assert.Equal("Maya's birthday", body.OccasionId);
    }

    [Fact]
    public void Ideas_for_everyone_buy_for_the_only_tagged_person_without_an_occasion()
    {
        var vm = new IdeasViewModel(Fake.Api().Api, new GroupState(new MemorySettingsStore()), new FakeNavigator(), new DataChanged());
        var kit = new Idea { Id = "kit", Title = "Kit", People = [new PersonRef { Id = "p9", Name = "Leo" }] };
        vm.SetData(new IdeaList { Ideas = [kit] }, null, "CAD");
        Assert.False(vm.Ideas[0].IsTopPick);
        Assert.True(vm.Ideas[0].CanBuy);
        var body = vm.BuyBodyFor(kit);
        Assert.Equal("p9", body.PersonId);
        Assert.Null(body.OccasionId);
    }

    [Fact]
    public async Task Join_sends_the_chosen_family_and_ticked_fields()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("GET /me", Json.Me());
        handler.On("GET /invites/tok", """{"kind":"FAMILY","inviterName":"Alice","groupName":"Alice's group","familyName":"Chen family","expiresAt":"2026-12-01T00:00:00Z"}""");
        handler.On("GET /groups/g1/families", """[{"id":"other","name":"Neighbours","isOwnHousehold":false},{"id":"home","name":"Wei's household","isOwnHousehold":true}]""");
        handler.On("POST /invites/tok/accept", """{"connectionId":"c1"}""");
        var groups = new GroupState(new MemorySettingsStore());
        var session = new Session(api, new Api.MemoryTokenStore("tok"), groups, new NoPush(), new MemorySettingsStore());
        await session.LoadAsync();
        var vm = new JoinViewModel(api, session, groups, new FakeNavigator(), new DataChanged());
        vm.Apply(new Dictionary<string, object> { [Params.Token] = "tok" });

        await vm.LoadAsync();
        Assert.Equal("Connect as Chen family on Bestowd", vm.Title);
        Assert.Equal("home", vm.SourceFamily?.Id);
        vm.Fields.Single(f => f.Field == "avoid").IsOn = false;
        vm.Fields.Single(f => f.Field == "sizes").IsOn = true;
        await vm.AcceptAsync();

        Assert.True(vm.Connected);
        using var doc = JsonDocument.Parse(handler.Last.Body!);
        Assert.Equal("home", doc.RootElement.GetProperty("sourceFamilyId").GetString());
        Assert.Equal(["birthday", "likes", "sizes"], doc.RootElement.GetProperty("sharedFields").EnumerateArray().Select(e => e.GetString()!));
    }

    [Fact]
    public async Task Join_marks_a_used_link_as_unusable()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("GET /invites/old", """{"error":"This invite has already been used"}""", System.Net.HttpStatusCode.Gone);
        var groups = new GroupState(new MemorySettingsStore());
        var vm = new JoinViewModel(api, new Session(api, new Api.MemoryTokenStore(), groups, new NoPush(), new MemorySettingsStore()), groups, new FakeNavigator(), new DataChanged());
        vm.Apply(new Dictionary<string, object> { [Params.Token] = "old" });
        await vm.LoadAsync();
        Assert.True(vm.LinkUnusable);
    }

    [Fact]
    public void Account_settings_validate_and_build_a_patch()
    {
        var groups = new GroupState(new MemorySettingsStore());
        var (api, _, _) = Fake.Api();
        var vm = new AccountViewModel(api, new Session(api, new Api.MemoryTokenStore(), groups, new NoPush(), new MemorySettingsStore()), groups, new FakeNavigator(), new FakePrompts())
        {
            GroupName = "Family", Currency = "cad", ReminderDays = "14, 3",
        };
        Assert.Equal("""{"name":"Family","currency":"CAD","defaultBudgets":{},"defaultReminderDays":[14,3]}""", vm.BuildSettingsPatch()!.ToJson());

        vm.Currency = "C$";
        Assert.Null(vm.BuildSettingsPatch());
        Assert.Equal("Currency is three letters, like CAD.", vm.Error);

        vm.Currency = "CAD";
        vm.ReminderDays = "14, soon";
        Assert.Null(vm.BuildSettingsPatch());
    }

    [Fact]
    public void Log_gift_sends_received_fields_only_for_received_gifts()
    {
        var groups = new GroupState(new MemorySettingsStore());
        var (api, _, _) = Fake.Api();
        var session = new Session(api, new Api.MemoryTokenStore(), groups, new NoPush(), new MemorySettingsStore());
        var vm = new LogGiftViewModel(api, groups, session, new FakeNavigator(), new DataChanged())
        {
            Title = "Cookie tin", Subject = new SubjectOption("Chen family", null, "f1"), Amount = "30", IsReceived = true,
            Date = new DateTime(2026, 2, 1),
        };
        var received = vm.BuildBody()!;
        Assert.Equal(GiftDirection.Received, received.Direction);
        Assert.True(received.ValueHidden);
        Assert.Null(received.Status);
        Assert.Equal("2026-02-01", received.Date);
        Assert.Equal("From", vm.SubjectLabel);

        vm.IsReceived = false;
        vm.BoughtNotGiven = true;
        var given = vm.BuildBody()!;
        Assert.Equal(GiftStatus.Bought, given.Status);
        Assert.Null(given.ValueHidden);

        vm.Amount = "lots";
        Assert.Null(vm.BuildBody());
        Assert.NotNull(vm.Error);
    }

    [Fact]
    public void Family_member_lines_show_the_age_they_turn()
    {
        Assert.Equal("Turns 5 · Nov 22", FamilyViewModel.MemberLine(new ProfilePerson
        {
            Name = "Maya", BirthYear = 2021, BirthMonth = 11, BirthDay = 22, NextBirthday = new DateTime(2026, 11, 22, 0, 0, 0, DateTimeKind.Utc),
        }));
        Assert.Equal("Parent · Jul 14", FamilyViewModel.MemberLine(new ProfilePerson { Name = "Jenny", Relationship = "Parent", BirthMonth = 7, BirthDay = 14 }));
        Assert.Equal("No birthday yet", FamilyViewModel.MemberLine(new ProfilePerson { Name = "X" }));
    }

    [Fact]
    public void Shared_details_list_only_what_was_shared()
    {
        Assert.Equal("Loves Dinosaurs", FamilyViewModel.SharedDetails(new SharedPerson { Name = "Lily", Likes = ["Dinosaurs"] }));
        Assert.Equal("Nothing shared yet", FamilyViewModel.SharedDetails(new SharedPerson { Name = "Lily" }));
    }
}
