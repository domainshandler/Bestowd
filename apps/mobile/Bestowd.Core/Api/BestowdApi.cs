using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using Bestowd.Core.Models;

namespace Bestowd.Core.Api;

/// <summary>
/// The Bestowd API, one method per route. Mirrors packages/api-client.
/// Errors come back as <see cref="ApiException"/> with the API's message.
/// </summary>
public sealed class BestowdApi(HttpClient http, ITokenStore tokens)
{
    private static readonly ApiJson Json = ApiJson.Default;

    /// <summary>Raised when the API answers 401, so the app can return to sign-in.</summary>
    public event EventHandler? Unauthorized;

    // ---- Auth ----

    public async Task<AuthResult> GoogleLoginAsync(string idToken, CancellationToken ct = default)
    {
        var result = await SendAsync(HttpMethod.Post, "/auth/google", Body(new GoogleLoginBody { IdToken = idToken }, Json.GoogleLoginBody), Json.AuthResult, ct);
        await tokens.SetAsync(result.Token);
        return result;
    }

    public Task<User> GetAuthMeAsync(CancellationToken ct = default) => GetAsync("/auth/me", Json.User, ct);
    public Task<Me> GetMeAsync(CancellationToken ct = default) => GetAsync("/me", Json.Me, ct);

    public Task RegisterDeviceAsync(DevicePlatform platform, string token, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, "/me/devices", Body(new RegisterDeviceBody { Platform = platform, Token = token }, Json.RegisterDeviceBody), ct);

    public Task UnregisterDeviceAsync(string token, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Delete, $"/me/devices/{Uri.EscapeDataString(token)}", null, ct);

    // ---- Autofill ----

    /// <summary>Suggestions for a form field ("title", "brand", "store" or "category") as the user types.</summary>
    public async Task<List<Suggestion>> SuggestAsync(string groupId, string field, string q, CancellationToken ct = default) =>
        (await GetAsync($"/groups/{groupId}/suggest{Query(("field", field), ("q", q))}", Json.SuggestionList, ct)).Suggestions;

    // ---- Photos ----

    /// <summary>Uploads a photo (already shrunk to a JPEG) for the group; returns the link to save on an idea or gift.</summary>
    public async Task<string> UploadPhotoAsync(string groupId, byte[] jpeg, CancellationToken ct = default)
    {
        var content = new ByteArrayContent(jpeg);
        content.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        return (await SendAsync(HttpMethod.Post, $"/groups/{groupId}/photos", content, Json.PhotoUpload, ct)).Url;
    }

    /// <summary>An image link the app can load: photos uploaded to Bestowd are served by the API.</summary>
    public string? PhotoUri(string? url) =>
        string.IsNullOrEmpty(url) ? null
        : url.StartsWith("/files/", StringComparison.Ordinal) && http.BaseAddress is { } b ? new Uri(b, url).ToString()
        : url;

    // ---- Groups ----

    public Task<Group> GetGroupAsync(string groupId, CancellationToken ct = default) => GetAsync($"/groups/{groupId}", Json.Group, ct);

    public Task<Group> UpdateGroupAsync(string groupId, Patch patch, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Patch, $"/groups/{groupId}", Body(patch), Json.Group, ct);

    // ---- Families and people ----

    public Task<List<FamilyListItem>> ListFamiliesAsync(string groupId, FamilyStatus? status = null, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/families{Query(("status", status is null ? null : ApiJson.EnumName(status.Value)))}", Json.ListFamilyListItem, ct);

    public Task<Family> CreateFamilyAsync(string groupId, CreateFamilyBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/families", Body(body, Json.CreateFamilyBody), Json.Family, ct);

    public Task<FamilyProfile> GetFamilyAsync(string id, CancellationToken ct = default) => GetAsync($"/families/{id}", Json.FamilyProfile, ct);

    public Task<Family> UpdateFamilyAsync(string id, Patch patch, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Patch, $"/families/{id}", Body(patch), Json.Family, ct);

    public Task DeleteFamilyAsync(string id, CancellationToken ct = default) => SendAsync(HttpMethod.Delete, $"/families/{id}", null, ct);

    public Task<List<PersonListItem>> ListPeopleAsync(string groupId, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/people", Json.ListPersonListItem, ct);

    public Task<Person> CreatePersonAsync(string familyId, PersonBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/families/{familyId}/people", Body(body, Json.PersonBody), Json.Person, ct);

    public Task<PersonDetail> GetPersonAsync(string id, CancellationToken ct = default) => GetAsync($"/people/{id}", Json.PersonDetail, ct);

    public Task<Person> UpdatePersonAsync(string id, Patch patch, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Patch, $"/people/{id}", Body(patch), Json.Person, ct);

    public Task DeletePersonAsync(string id, CancellationToken ct = default) => SendAsync(HttpMethod.Delete, $"/people/{id}", null, ct);

    // ---- Occasions ----

    /// <summary>Home: upcoming occasions across all of the user's groups (default: the next 30 days).</summary>
    public Task<HomeOccasions> ListHomeOccasionsAsync(OccasionType? type = null, CancellationToken ct = default) =>
        GetAsync($"/me/occasions{Query(("type", type is null ? null : ApiJson.EnumName(type.Value)))}", Json.HomeOccasions, ct);

    public Task<GroupOccasions> ListOccasionsAsync(string groupId, string? personId = null, string? familyId = null, DateOnly? from = null, DateOnly? to = null, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/occasions{Query(("personId", personId), ("familyId", familyId), ("from", DateText(from)), ("to", DateText(to)))}", Json.GroupOccasions, ct);

    public Task<Occasion> CreateOccasionAsync(string groupId, CreateOccasionBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/occasions", Body(body, Json.CreateOccasionBody), Json.Occasion, ct);

    public Task<Occasion> GetOccasionAsync(string id, CancellationToken ct = default) =>
        GetAsync($"/occasions/{id}", Json.Occasion, ct);

    /// <summary>A group-wide occasion: a built-in holiday or your own, covering families in the group.</summary>
    public Task<Occasion> CreateGroupOccasionAsync(string groupId, CreateGroupOccasionBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/occasions", Body(body, Json.CreateGroupOccasionBody), Json.Occasion, ct);

    /// <summary>The built-in holidays: next dates, the group's occasion for each (if added), and what it dismissed.</summary>
    public Task<HolidayChoices> ListHolidaysAsync(string groupId, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/holidays", Json.HolidayChoices, ct);

    /// <summary>Answers "Which holidays do you celebrate?": adds the picked ones and stops suggesting the rest.</summary>
    public Task<HolidayChoices> ChooseHolidaysAsync(string groupId, IEnumerable<string> keys, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/holidays/choose", Body(new ChooseHolidaysBody { Keys = keys.ToList() }, Json.ChooseHolidaysBody), Json.HolidayChoices, ct);

    /// <summary>"Not for us": stop suggesting a holiday.</summary>
    public Task<HolidayChoices> DismissHolidayAsync(string groupId, string key, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/holidays/{Uri.EscapeDataString(key)}/dismiss", null, Json.HolidayChoices, ct);

    /// <summary>Sets the families a group-wide occasion covers, with optional budget overrides.</summary>
    public Task<Occasion> SetOccasionFamiliesAsync(string id, IEnumerable<FamilyBudget> families, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Put, $"/occasions/{id}/families", Body(new SetFamiliesBody { Families = families.ToList() }, Json.SetFamiliesBody), Json.Occasion, ct);

    public Task<Occasion> UpdateOccasionAsync(string id, Patch patch, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Patch, $"/occasions/{id}", Body(patch), Json.Occasion, ct);

    public Task DeleteOccasionAsync(string id, CancellationToken ct = default) => SendAsync(HttpMethod.Delete, $"/occasions/{id}", null, ct);

    // ---- Gifts ----

    public Task<GiftList> ListGiftsAsync(string groupId, int? year = null, GiftDirection? direction = null, GiftStatus? status = null,
        string? personId = null, string? familyId = null, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/gifts{Query(
            ("year", year?.ToString(CultureInfo.InvariantCulture)),
            ("direction", direction is null ? null : ApiJson.EnumName(direction.Value)),
            ("status", status is null ? null : ApiJson.EnumName(status.Value)),
            ("personId", personId), ("familyId", familyId))}", Json.GiftList, ct);

    public Task<Gift> GetGiftAsync(string id, CancellationToken ct = default) => GetAsync($"/gifts/{id}", Json.Gift, ct);

    public Task<Gift> CreateGiftAsync(string groupId, CreateGiftBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/gifts", Body(body, Json.CreateGiftBody), Json.Gift, ct);

    public Task<Gift> UpdateGiftAsync(string id, Patch patch, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Patch, $"/gifts/{id}", Body(patch), Json.Gift, ct);

    public Task DeleteGiftAsync(string id, CancellationToken ct = default) => SendAsync(HttpMethod.Delete, $"/gifts/{id}", null, ct);

    // ---- Ideas ----

    /// <summary>Saved ideas: for a person (by tag or age), a family (tagged with anyone in it), or everyone.</summary>
    public Task<IdeaList> ListIdeasAsync(string groupId, string? personId = null, string? occasionId = null, string? familyId = null, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/ideas{Query(("personId", personId), ("occasionId", occasionId), ("familyId", familyId))}", Json.IdeaList, ct);

    public Task<Idea> CreateIdeaAsync(string groupId, CreateIdeaBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/ideas", Body(body, Json.CreateIdeaBody), Json.Idea, ct);

    public Task<Idea> UpdateIdeaAsync(string id, Patch patch, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Patch, $"/ideas/{id}", Body(patch), Json.Idea, ct);

    public Task<BuyIdeaResult> BuyIdeaAsync(string id, BuyIdeaBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/ideas/{id}/buy", Body(body, Json.BuyIdeaBody), Json.BuyIdeaResult, ct);

    // ---- Invites ----

    public Task<InviteLink> CreateInviteAsync(string groupId, InviteKind kind, string? familyId = null, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/invites", Body(new CreateInviteBody { Kind = kind, FamilyId = familyId }, Json.CreateInviteBody), Json.InviteLink, ct);

    public Task<InvitePreview> GetInviteAsync(string token, CancellationToken ct = default) =>
        GetAsync($"/invites/{Uri.EscapeDataString(token)}", Json.InvitePreview, ct);

    /// <summary>Group invites: what you could bring from your own group, or null.</summary>
    public async Task<MovableItems?> GetMovableAsync(string token, CancellationToken ct = default) =>
        (await GetAsync($"/invites/{Uri.EscapeDataString(token)}/movable", Json.MovableResponse, ct)).Movable;

    /// <summary>What you could still bring into a group you're in, and whether a request is already waiting.</summary>
    public Task<MovableResponse> GetGroupMovableAsync(string groupId, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/movable", Json.MovableResponse, ct);

    public Task<MoveRequestSummary> RequestMoveAsync(string groupId, MoveSelection body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/move-requests", Body(body, Json.MoveSelection), Json.MoveRequestSummary, ct);

    /// <summary>Pending requests into the group: all of them for the owner, your own for anyone else.</summary>
    public Task<List<MoveRequestSummary>> ListMoveRequestsAsync(string groupId, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/move-requests", Json.ListMoveRequestSummary, ct);

    public Task<MoveRequestDetail> GetMoveRequestAsync(string id, CancellationToken ct = default) =>
        GetAsync($"/move-requests/{id}", Json.MoveRequestDetail, ct);

    public Task<StatusResult> ApproveMoveAsync(string id, ApproveMoveBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/move-requests/{id}/approve", Body(body, Json.ApproveMoveBody), Json.StatusResult, ct);

    public Task<StatusResult> DeclineMoveAsync(string id, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/move-requests/{id}/decline", Body(new CreateGroupBody(), Json.CreateGroupBody), Json.StatusResult, ct);

    public Task<StatusResult> CancelMoveAsync(string id, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/move-requests/{id}/cancel", Body(new CreateGroupBody(), Json.CreateGroupBody), Json.StatusResult, ct);

    /// <summary>Start a new group of your own. It becomes the one the app opens to.</summary>
    public Task<Group> CreateGroupAsync(string? name, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, "/groups", Body(new CreateGroupBody { Name = name }, Json.CreateGroupBody), Json.Group, ct);

    public Task<List<GroupNotice>> ListNoticesAsync(string groupId, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/notices", Json.ListGroupNotice, ct);

    public Task DismissNoticeAsync(string id, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/notices/{id}/dismiss", Body(new CreateGroupBody(), Json.CreateGroupBody), ct);

    public Task<LeaveOptions> GetLeaveOptionsAsync(string groupId, CancellationToken ct = default) =>
        GetAsync($"/groups/{groupId}/leave-options", Json.LeaveOptions, ct);

    /// <summary>Leave a group. Returns the group to open next (a fresh one if it was your last).</summary>
    public Task<LeaveGroupResult> LeaveGroupAsync(string groupId, LeaveGroupBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/groups/{groupId}/leave", Body(body, Json.LeaveGroupBody), Json.LeaveGroupResult, ct);

    public Task<AcceptInviteResult> AcceptInviteAsync(string token, AcceptInviteBody body, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Post, $"/invites/{Uri.EscapeDataString(token)}/accept", Body(body, Json.AcceptInviteBody), Json.AcceptInviteResult, ct);

    public Task RevokeConnectionAsync(string id, CancellationToken ct = default) =>
        SendAsync(HttpMethod.Delete, $"/family-connections/{id}", null, ct);

    // ---- Plumbing ----

    public static string Query(params (string Key, string? Value)[] pairs)
    {
        var parts = pairs.Where(p => !string.IsNullOrEmpty(p.Value)).Select(p => $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value!)}").ToList();
        return parts.Count == 0 ? "" : "?" + string.Join("&", parts);
    }

    private static string? DateText(DateOnly? d) => d?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static HttpContent Body<T>(T value, JsonTypeInfo<T> info) =>
        new StringContent(JsonSerializer.Serialize(value, info), Encoding.UTF8, "application/json");

    private static HttpContent Body(Patch patch) => new StringContent(patch.ToJson(), Encoding.UTF8, "application/json");

    private Task<T> GetAsync<T>(string path, JsonTypeInfo<T> info, CancellationToken ct) => SendAsync(HttpMethod.Get, path, null, info, ct);

    private async Task<T> SendAsync<T>(HttpMethod method, string path, HttpContent? content, JsonTypeInfo<T> info, CancellationToken ct)
    {
        using var response = await SendRawAsync(method, path, content, ct);
        var stream = await response.Content.ReadAsStreamAsync(ct);
        return await JsonSerializer.DeserializeAsync(stream, info, ct) ?? throw new ApiException(response.StatusCode, "Empty response");
    }

    private async Task SendAsync(HttpMethod method, string path, HttpContent? content, CancellationToken ct)
    {
        using var _ = await SendRawAsync(method, path, content, ct);
    }

    private async Task<HttpResponseMessage> SendRawAsync(HttpMethod method, string path, HttpContent? content, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, path) { Content = content };
        var token = await tokens.GetAsync();
        if (!string.IsNullOrEmpty(token)) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await http.SendAsync(request, ct);
        if (response.IsSuccessStatusCode) return response;

        string message = response.ReasonPhrase ?? response.StatusCode.ToString();
        try
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            var error = string.IsNullOrWhiteSpace(body) ? null : JsonSerializer.Deserialize(body, Json.ErrorBody);
            if (!string.IsNullOrEmpty(error?.Error)) message = error.Error;
        }
        catch (JsonException) { /* not a JSON body; keep the reason phrase */ }

        var status = response.StatusCode;
        response.Dispose();
        if (status == HttpStatusCode.Unauthorized) Unauthorized?.Invoke(this, EventArgs.Empty);
        throw new ApiException(status, message);
    }
}
