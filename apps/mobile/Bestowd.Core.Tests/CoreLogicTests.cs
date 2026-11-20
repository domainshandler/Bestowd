using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Bestowd.Core.Auth;
using Bestowd.Core.Formatting;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.Tests;

public class GroupStateTests
{
    private static Me MeWith(string primary, params string[] ids) => new()
    {
        PrimaryGroupId = primary,
        Memberships = ids.Select(id => new Membership { GroupId = id, GroupName = id }).ToList(),
    };

    [Fact]
    public void Defaults_to_the_primary_group()
    {
        var state = new GroupState(new MemorySettingsStore());
        state.Load(MeWith("g1", "g2", "g1"));
        Assert.Equal("g1", state.GroupId);
        Assert.True(state.MultipleGroups);
    }

    [Fact]
    public void Remembers_a_chosen_group_across_sessions()
    {
        var settings = new MemorySettingsStore();
        new GroupState(settings).Load(MeWith("g1", "g1", "g2"));
        var first = new GroupState(settings);
        first.Load(MeWith("g1", "g1", "g2"));
        first.Select("g2");

        var later = new GroupState(settings);
        later.Load(MeWith("g1", "g1", "g2"));
        Assert.Equal("g2", later.GroupId);
    }

    [Fact]
    public void Falls_back_to_the_primary_group_when_the_stored_one_is_gone()
    {
        var settings = new MemorySettingsStore();
        settings.Set(GroupState.Key, "left-group");
        var state = new GroupState(settings);
        state.Load(MeWith("g1", "g1"));
        Assert.Equal("g1", state.GroupId);
        Assert.False(state.MultipleGroups);
    }
}

public class FormatTests
{
    private static readonly DateTime Now = new(2026, 11, 18, 23, 30, 0, DateTimeKind.Utc);

    [Fact]
    public void Counts_days_in_UTC()
    {
        Assert.Equal(4, Format.DaysUntil(new DateTime(2026, 11, 22, 0, 0, 0, DateTimeKind.Utc), Now));
        Assert.Equal("Today", Format.InDays(new DateTime(2026, 11, 18, 0, 0, 0, DateTimeKind.Utc), Now));
        Assert.Equal("Tomorrow", Format.InDays(new DateTime(2026, 11, 19, 0, 0, 0, DateTimeKind.Utc), Now));
        Assert.Equal("In 7 days", Format.InDays(new DateTime(2026, 11, 25, 0, 0, 0, DateTimeKind.Utc), Now));
    }

    [Fact]
    public void Formats_dates_birthdays_and_initials()
    {
        var d = new DateTime(2026, 11, 22, 0, 0, 0, DateTimeKind.Utc);
        Assert.Equal("Nov 22", Format.ShortDate(d));
        Assert.Equal("Sun, Nov 22", Format.DayDate(d));
        Assert.Equal("NOV", Format.MonthShort(d));
        Assert.Equal("Mar 9", Format.Birthday(3, 9));
        Assert.Equal("Mar", Format.Birthday(3, null));
        Assert.Equal("", Format.Birthday(null, 9));
        Assert.Equal("MC", Format.Initials(" Maya  Chen "));
        Assert.Equal("?", Format.Initials(""));
    }

    [Fact]
    public void Formats_money_with_the_local_symbol_for_the_local_currency()
    {
        Assert.Equal("$40", Format.Money(40m, "CAD", new CultureInfo("en-CA")));
        Assert.Equal("$24.50", Format.Money(24.5m, "CAD", new CultureInfo("en-CA")));
        Assert.Equal("CA$40", Format.Money(40m, "CAD", new CultureInfo("en-US")));
        Assert.Equal("", Format.Money(null, "CAD"));
    }

    [Fact]
    public void Splits_comma_lists()
    {
        Assert.Equal(["Painting", "Dinosaurs"], Format.SplitList(" Painting, Dinosaurs ,, "));
    }
}

public class GoogleSignInTests
{
    private const string ClientId = "1234-abc.apps.googleusercontent.com";

    [Fact]
    public void Uses_the_reversed_client_id_as_redirect_and_a_S256_challenge()
    {
        var request = GoogleSignIn.CreateRequest(ClientId);
        Assert.Equal("com.googleusercontent.apps.1234-abc:/oauth2redirect", request.RedirectUri.ToString());

        var query = request.AuthorizeUrl.Query.TrimStart('?').Split('&').Select(p => p.Split('=')).ToDictionary(p => p[0], p => Uri.UnescapeDataString(p[1]));
        Assert.Equal(ClientId, query["client_id"]);
        Assert.Equal("S256", query["code_challenge_method"]);
        Assert.Equal("openid email profile", query["scope"]);
        var expected = Convert.ToBase64String(SHA256.HashData(Encoding.ASCII.GetBytes(request.CodeVerifier))).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        Assert.Equal(expected, query["code_challenge"]);
        Assert.Equal(request.State, query["state"]);
    }

    [Fact]
    public void Checks_state_and_reports_cancellation()
    {
        var request = GoogleSignIn.CreateRequest(ClientId);
        Assert.Equal("the-code", GoogleSignIn.ParseCallback(new Dictionary<string, string> { ["code"] = "the-code", ["state"] = request.State }, request));
        Assert.Throws<GoogleSignInException>(() => GoogleSignIn.ParseCallback(new Dictionary<string, string> { ["code"] = "c", ["state"] = "forged" }, request));
        var cancelled = Assert.Throws<GoogleSignInException>(() => GoogleSignIn.ParseCallback(new Dictionary<string, string> { ["error"] = "access_denied" }, request));
        Assert.Equal("Sign-in was cancelled", cancelled.Message);
    }

    [Fact]
    public async Task Exchanges_the_code_with_the_verifier_for_an_id_token()
    {
        var handler = new FakeHandler().On("POST /token", """{"access_token":"a","id_token":"the-id-token","expires_in":3599}""");
        var request = GoogleSignIn.CreateRequest(ClientId);

        var idToken = await GoogleSignIn.ExchangeCodeAsync(new HttpClient(handler), ClientId, "the-code", request);

        Assert.Equal("the-id-token", idToken);
        Assert.Contains($"code_verifier={request.CodeVerifier}", handler.Last.Body);
        Assert.Contains("grant_type=authorization_code", handler.Last.Body);
    }

    [Fact]
    public void Rejects_a_non_google_client_id()
    {
        Assert.Throws<ArgumentException>(() => GoogleSignIn.RedirectUriFor("not-a-client-id"));
    }
}
