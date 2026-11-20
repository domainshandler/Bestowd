using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Bestowd.Core.Auth;

/// <summary>A pending Google sign-in: open <see cref="AuthorizeUrl"/> in the system browser, then call <see cref="GoogleSignIn.ParseCallback"/>.</summary>
public sealed record GoogleAuthRequest(Uri AuthorizeUrl, Uri RedirectUri, string CodeVerifier, string State);

/// <summary>
/// Google sign-in for installed apps: authorization code + PKCE in the system browser (no client secret),
/// then the code is exchanged for an ID token that the Bestowd API verifies.
/// </summary>
public static class GoogleSignIn
{
    public const string AuthorizeEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
    public const string TokenEndpoint = "https://oauth2.googleapis.com/token";

    /// <summary>Google's redirect for mobile client IDs: the client ID reversed, e.g. com.googleusercontent.apps.123-abc:/oauth2redirect.</summary>
    public static Uri RedirectUriFor(string clientId)
    {
        const string suffix = ".apps.googleusercontent.com";
        if (!clientId.EndsWith(suffix, StringComparison.Ordinal)) throw new ArgumentException("Not a Google OAuth client ID", nameof(clientId));
        return new Uri($"com.googleusercontent.apps.{clientId[..^suffix.Length]}:/oauth2redirect");
    }

    public static GoogleAuthRequest CreateRequest(string clientId)
    {
        var redirect = RedirectUriFor(clientId);
        var verifier = Base64Url(RandomNumberGenerator.GetBytes(32));
        var challenge = Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var state = Base64Url(RandomNumberGenerator.GetBytes(16));
        var query = string.Join("&", new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["redirect_uri"] = redirect.ToString(),
            ["response_type"] = "code",
            ["scope"] = "openid email profile",
            ["code_challenge"] = challenge,
            ["code_challenge_method"] = "S256",
            ["state"] = state,
            ["prompt"] = "select_account",
        }.Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value)}"));
        return new GoogleAuthRequest(new Uri($"{AuthorizeEndpoint}?{query}"), redirect, verifier, state);
    }

    /// <summary>The authorization code from the redirect's parameters, after checking state. Throws when Google reports an error.</summary>
    public static string ParseCallback(IReadOnlyDictionary<string, string> parameters, GoogleAuthRequest request)
    {
        if (parameters.TryGetValue("error", out var error)) throw new GoogleSignInException(error == "access_denied" ? "Sign-in was cancelled" : $"Google sign-in failed: {error}");
        if (!parameters.TryGetValue("state", out var state) || state != request.State) throw new GoogleSignInException("Sign-in response didn't match the request");
        if (!parameters.TryGetValue("code", out var code) || string.IsNullOrEmpty(code)) throw new GoogleSignInException("Google didn't return a sign-in code");
        return code;
    }

    /// <summary>Exchanges the code for tokens and returns the ID token.</summary>
    public static async Task<string> ExchangeCodeAsync(HttpClient http, string clientId, string code, GoogleAuthRequest request, CancellationToken ct = default)
    {
        using var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["code"] = code,
            ["code_verifier"] = request.CodeVerifier,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = request.RedirectUri.ToString(),
        });
        using var response = await http.PostAsync(TokenEndpoint, form, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode) throw new GoogleSignInException("Google rejected the sign-in code");
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.TryGetProperty("id_token", out var idToken) && idToken.GetString() is { Length: > 0 } t
            ? t
            : throw new GoogleSignInException("Google didn't return an ID token");
    }

    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public sealed class GoogleSignInException(string message) : Exception(message);
