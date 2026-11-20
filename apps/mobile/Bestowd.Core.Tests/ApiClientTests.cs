using System.Net;
using System.Text.Json;
using Bestowd.Core.Api;
using Bestowd.Core.Models;

namespace Bestowd.Core.Tests;

public class ApiClientTests
{
    [Fact]
    public async Task Sends_the_bearer_token_and_reads_api_json()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("GET /me/occasions", $"{{\"occasions\":[{Json.Occasion}],\"plannedSpend\":[{{\"currency\":\"CAD\",\"amount\":40}}],\"multipleGroups\":false}}");

        var home = await api.ListHomeOccasionsAsync();

        Assert.Equal("Bearer tok", handler.Last.Auth);
        var o = Assert.Single(home.Occasions);
        Assert.Equal(OccasionType.Birthday, o.Type);
        Assert.Equal(OccasionStatus.NotStarted, o.Status);
        Assert.Equal(40m, o.EffectiveBudget);
        Assert.Equal(new DateTime(2026, 11, 22, 0, 0, 0, DateTimeKind.Utc), o.NextOccurrence!.Value.ToUniversalTime());
        Assert.Equal(40m, home.PlannedSpend[0].Amount);
    }

    [Fact]
    public async Task Builds_query_strings_with_api_enum_names_and_skips_empty_values()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("GET /groups/g1/gifts", """{"currency":"CAD","gifts":[],"totals":{}}""");
        handler.On("GET /me/occasions", """{"occasions":[],"plannedSpend":[],"multipleGroups":false}""");

        await api.ListGiftsAsync("g1", year: 2026, direction: GiftDirection.Given, status: GiftStatus.Bought);
        Assert.Equal("/groups/g1/gifts?year=2026&direction=GIVEN&status=BOUGHT", handler.Last.PathAndQuery);

        await api.ListHomeOccasionsAsync(OccasionType.OneOff);
        Assert.Equal("/me/occasions?type=ONE_OFF", handler.Last.PathAndQuery);
    }

    [Fact]
    public async Task Turns_error_bodies_into_ApiException_and_reports_401()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("POST /invites/used/accept", """{"error":"This invite has already been used"}""", HttpStatusCode.Gone);
        handler.On("GET /me", """{"error":"Unauthorized"}""", HttpStatusCode.Unauthorized);
        var unauthorized = 0;
        api.Unauthorized += (_, _) => unauthorized++;

        var gone = await Assert.ThrowsAsync<ApiException>(() => api.AcceptInviteAsync("used", new AcceptInviteBody()));
        Assert.True(gone.IsGone);
        Assert.Equal("This invite has already been used", gone.Message);

        var auth = await Assert.ThrowsAsync<ApiException>(() => api.GetMeAsync());
        Assert.True(auth.IsUnauthorized);
        Assert.Equal(1, unauthorized);
    }

    [Fact]
    public async Task Create_bodies_leave_out_nulls_so_api_defaults_apply()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("POST /groups/g1/gifts", """{"id":"x","direction":"RECEIVED","title":"Book","date":"2026-01-01T00:00:00Z","credits":[]}""");

        await api.CreateGiftAsync("g1", new CreateGiftBody { Direction = GiftDirection.Received, Title = "Book", Date = "2026-01-01", FamilyId = "f1", Reaction = Reaction.AlreadyHadIt });

        using var doc = JsonDocument.Parse(handler.Last.Body!);
        var root = doc.RootElement;
        Assert.Equal("RECEIVED", root.GetProperty("direction").GetString());
        Assert.Equal("ALREADY_HAD_IT", root.GetProperty("reaction").GetString());
        Assert.False(root.TryGetProperty("personId", out _));
        Assert.False(root.TryGetProperty("valueHidden", out _));
    }

    [Fact]
    public void Patch_sends_only_what_is_set_including_explicit_nulls()
    {
        var patch = new Patch().Set("valueHidden", false).Set("budget", (decimal?)null).SetEnum("status", FamilyStatus.Paused)
            .Set("likes", ["Lego", "Books"]).SetDate("date", new DateOnly(2026, 3, 9)).SetNumbers("defaultReminderDays", [14, 3]);
        Assert.Equal("""{"valueHidden":false,"budget":null,"status":"PAUSED","likes":["Lego","Books"],"date":"2026-03-09","defaultReminderDays":[14,3]}""", patch.ToJson());
    }

    [Fact]
    public async Task Google_login_stores_the_session_token()
    {
        var (api, handler, tokens) = Fake.Api(token: null);
        handler.On("POST /auth/google", """{"token":"jwt-1","user":{"id":"u1","email":"a@b.c","name":"A","emailVerified":true,"identitySource":"google","createdAt":"2026-01-01T00:00:00Z"}}""");

        await api.GoogleLoginAsync("google-id-token");

        Assert.Null(handler.Last.Auth);
        Assert.Equal("""{"idToken":"google-id-token"}""", handler.Last.Body);
        Assert.Equal("jwt-1", await tokens.GetAsync());
    }

    [Fact]
    public void Enum_names_match_the_api()
    {
        Assert.Equal("NOT_A_HIT", ApiJson.EnumName(Reaction.NotAHit));
        Assert.Equal("IOS", ApiJson.EnumName(DevicePlatform.Ios));
        Assert.Equal("IDEA_SAVED", ApiJson.EnumName(OccasionStatus.IdeaSaved));
    }
}
