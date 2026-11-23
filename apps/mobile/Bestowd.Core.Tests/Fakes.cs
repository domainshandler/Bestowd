using System.Net;
using System.Text;
using Bestowd.Core.Api;
using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

/// <summary>Answers requests from a table of "METHOD /path" → (status, json), and records what was sent.</summary>
public sealed class FakeHandler : HttpMessageHandler
{
    public Dictionary<string, (HttpStatusCode Status, string Json)> Responses { get; } = [];
    public List<(HttpMethod Method, string PathAndQuery, string? Body, string? Auth)> Requests { get; } = [];

    public FakeHandler On(string key, string json, HttpStatusCode status = HttpStatusCode.OK) { Responses[key] = (status, json); return this; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
        var pathAndQuery = request.RequestUri!.PathAndQuery;
        Requests.Add((request.Method, pathAndQuery, body, request.Headers.Authorization?.ToString()));
        var key = Responses.Keys.FirstOrDefault(k => k == $"{request.Method} {pathAndQuery}")
            ?? Responses.Keys.FirstOrDefault(k => k == $"{request.Method} {request.RequestUri.AbsolutePath}");
        if (key is null) return new HttpResponseMessage(HttpStatusCode.NotFound) { Content = new StringContent("{\"error\":\"Not found\"}", Encoding.UTF8, "application/json") };
        var (status, json) = Responses[key];
        return new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    }

    public (HttpMethod Method, string PathAndQuery, string? Body, string? Auth) Last => Requests[^1];
}

public static class Fake
{
    public static (BestowdApi Api, FakeHandler Handler, MemoryTokenStore Tokens) Api(string? token = "tok")
    {
        var handler = new FakeHandler();
        var tokens = new MemoryTokenStore(token);
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.test") };
        return (new BestowdApi(http, tokens), handler, tokens);
    }
}

public sealed class FakeNavigator : INavigator
{
    public List<(string Route, IDictionary<string, object>? Parameters)> Visited { get; } = [];
    public int BackCount { get; private set; }
    public Task GoToAsync(string route, IDictionary<string, object>? parameters = null) { Visited.Add((route, parameters)); return Task.CompletedTask; }
    public Task GoBackAsync() { BackCount++; return Task.CompletedTask; }
}

public sealed class FakePrompts : IPrompts
{
    public bool Answer { get; set; } = true;
    public List<string> Shared { get; } = [];
    public Task<bool> ConfirmAsync(string title, string message, string accept, string cancel = "Cancel") => Task.FromResult(Answer);
    public Task AlertAsync(string title, string message) => Task.CompletedTask;
    public Task ShareAsync(string title, string text) { Shared.Add(text); return Task.CompletedTask; }
    /// <summary>Answers ChooseAsync (null = cancelled).</summary>
    public string? Choice { get; set; }
    public string? Text { get; set; }
    public List<string> Asked { get; } = [];
    public Task<string?> ChooseAsync(string title, IReadOnlyList<string> options) { Asked.Add(title); return Task.FromResult(Choice); }
    public Task<string?> AskTextAsync(string title, string message, string placeholder) { Asked.Add(title); return Task.FromResult(Text); }
}

public static class Json
{
    public const string Occasion = """
    {"id":"o1","groupId":"g1","groupName":"Renny's group","currency":"CAD","personId":"p1","familyId":null,"type":"BIRTHDAY",
     "name":"Maya's birthday","date":"2019-11-22T00:00:00.000Z","recursAnnually":true,"recurrenceEndsAt":null,
     "nextOccurrence":"2026-11-22T00:00:00.000Z","budget":null,"status":"NOT_STARTED","needsCard":false,"cardDone":false,
     "reminderDays":[],"partyAt":null,"location":null,"rsvp":"NONE","hostGiftRequest":null,
     "createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z",
     "subjectName":"Maya","subjectFamilyId":"f1","subjectFamilyName":"Chen family","effectiveBudget":40,"spent":0,"overBudget":false,"needsGift":true}
    """;

    public static string Me(string primary = "g1", params (string Id, string Name, string Role)[] groups)
    {
        var list = groups.Length == 0 ? [("g1", "Mine", "OWNER")] : groups;
        var memberships = string.Join(",", list.Select(g => $"{{\"groupId\":\"{g.Id}\",\"groupName\":\"{g.Name}\",\"role\":\"{g.Role}\",\"memberCount\":1}}"));
        return $"{{\"user\":{{\"id\":\"u1\",\"email\":\"r@example.com\",\"name\":\"Renny Sheldon\",\"avatarUrl\":null,\"identitySource\":\"google\",\"emailVerified\":true,\"createdAt\":\"2026-01-01T00:00:00.000Z\"}},\"primaryGroupId\":\"{primary}\",\"memberships\":[{memberships}]}}";
    }
}
