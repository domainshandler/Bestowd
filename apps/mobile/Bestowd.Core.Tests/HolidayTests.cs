using System.Net;
using System.Text.Json;
using Bestowd.Core.Api;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;
using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

public class HolidayTests
{
    private static readonly DateTime Now = new(2026, 11, 23, 12, 0, 0, DateTimeKind.Utc);
    private static DateTime D(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);
    private static Holiday H(string key, string name, DateTime? next, string? occasionId = null, bool dismissed = false, string? note = null) =>
        new() { Key = key, Name = name, NextDate = next, OccasionId = occasionId, Dismissed = dismissed, Note = note };

    private static GroupState Group()
    {
        var state = new GroupState(new MemorySettingsStore());
        state.Load(new Me { PrimaryGroupId = "g1", Memberships = [new Membership { GroupId = "g1", GroupName = "Mine", Role = MembershipRole.Owner }] });
        return state;
    }

    [Fact]
    public void Suggests_upcoming_holidays_not_added_or_dismissed_soonest_first()
    {
        var list = Holidays.Suggested(
        [
            H("christmas", "Christmas", D(2026, 12, 25)),
            H("hanukkah", "Hanukkah", D(2026, 12, 5)),
            H("valentines", "Valentine's Day", D(2027, 2, 14)),
            H("easter", "Easter", D(2026, 12, 1), occasionId: "o1"),
            H("diwali", "Diwali", D(2026, 12, 2), dismissed: true),
        ], Now);
        Assert.Equal(["hanukkah", "christmas"], list.Select(s => s.Key));
        Assert.Equal("Dec 25 · In 32 days · not tracked yet", list[1].Line);
    }

    [Fact]
    public void Home_asks_until_the_group_has_chosen_then_suggests()
    {
        var vm = new HomeViewModel(Fake.Api().Api, new FakeNavigator(), Group(), new DataChanged());
        vm.ApplyHolidays(new HolidayChoices { Chosen = false, Holidays = [H("christmas", "Christmas", D(2026, 12, 25))] }, Now);
        Assert.True(vm.AskHolidays);
        Assert.Empty(vm.SuggestedHolidays);

        vm.ApplyHolidays(new HolidayChoices { Chosen = true, Holidays = [H("christmas", "Christmas", D(2026, 12, 25))] }, Now);
        Assert.False(vm.AskHolidays);
        Assert.Single(vm.SuggestedHolidays);
    }

    [Fact]
    public async Task Track_it_adds_the_holiday_and_opens_it()
    {
        var (api, handler, _) = Fake.Api();
        var created = new Occasion { Id = "xmas", Name = "Christmas", Scope = OccasionScope.Group };
        handler.On("POST /groups/g1/occasions", JsonSerializer.Serialize(created, ApiJson.Default.Occasion), HttpStatusCode.Created);
        var nav = new FakeNavigator();
        var changes = new DataChanged();
        var vm = new HomeViewModel(api, nav, Group(), changes);
        await vm.TrackHolidayCommand.ExecuteAsync(new HolidaySuggestion("christmas", "Christmas", ""));

        var body = JsonElement.Parse(handler.Last.Body!);
        Assert.True(body.GetProperty("groupWide").GetBoolean());
        Assert.Equal("christmas", body.GetProperty("holidayKey").GetString());
        Assert.Equal((Routes.GroupOccasion, "xmas"), (nav.Visited.Single().Route, (string)nav.Visited.Single().Parameters![Params.Id]));
        Assert.Equal(1, changes.Version);
    }

    [Fact]
    public async Task Not_for_us_dismisses_and_refreshes_the_suggestions()
    {
        var (api, handler, _) = Fake.Api();
        var after = new HolidayChoices { Chosen = true, Holidays = [H("christmas", "Christmas", D(2026, 12, 25), dismissed: true)] };
        handler.On("POST /groups/g1/holidays/christmas/dismiss", JsonSerializer.Serialize(after, ApiJson.Default.HolidayChoices));
        var vm = new HomeViewModel(api, new FakeNavigator(), Group(), new DataChanged());
        vm.ApplyHolidays(new HolidayChoices { Chosen = true, Holidays = [H("christmas", "Christmas", D(2026, 12, 25))] }, Now);
        await vm.DismissHolidayCommand.ExecuteAsync(vm.SuggestedHolidays[0]);
        Assert.Empty(vm.SuggestedHolidays);
    }

    [Fact]
    public async Task Checklist_ticks_added_holidays_and_sends_the_picks()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("POST /groups/g1/holidays/choose", JsonSerializer.Serialize(new HolidayChoices { Chosen = true }, ApiJson.Default.HolidayChoices));
        var nav = new FakeNavigator();
        var vm = new HolidayChoiceViewModel(api, Group(), nav, new DataChanged());
        vm.Apply(new Dictionary<string, object> { [Params.GroupId] = "g1" });
        vm.SetData(new HolidayChoices
        {
            Holidays =
            [
                H("christmas", "Christmas", D(2026, 12, 25), occasionId: "o1"),
                H("diwali", "Diwali", D(2027, 10, 29), note: "Lakshmi Puja day"),
                H("old", "Ran out", null),
            ],
        });
        Assert.Equal(["christmas", "diwali"], vm.Holidays.Select(h => h.Key));
        Assert.True(vm.Holidays[0].IsOn);
        Assert.Equal("Next: Oct 29 · Lakshmi Puja day", vm.Holidays[1].Hint);

        vm.Holidays[1].IsOn = true;
        await vm.SaveCommand.ExecuteAsync(null);
        var keys = JsonElement.Parse(handler.Last.Body!).GetProperty("keys").EnumerateArray().Select(k => k.GetString());
        Assert.Equal(["christmas", "diwali"], keys);
        Assert.Equal(1, nav.BackCount);
    }
}
