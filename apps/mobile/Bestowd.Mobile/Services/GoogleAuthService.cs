using Bestowd.Core.Auth;

namespace Bestowd.Mobile.Services;

/// <summary>
/// Google sign-in, returning a Google ID token for the Bestowd API.
/// Android: Credential Manager ("Sign in with Google"); Google no longer allows browser redirects into Android apps.
/// iOS: the system browser (ASWebAuthenticationSession) with PKCE and the reversed iOS client ID as redirect.
/// </summary>
// The HttpClient and instance methods are used by the iOS sign-in only; on Android the analyzers see them as unused.
[System.Diagnostics.CodeAnalysis.SuppressMessage("Style", "IDE0052", Justification = "Used on iOS.")]
[System.Diagnostics.CodeAnalysis.SuppressMessage("Performance", "CA1822", Justification = "Instance methods on iOS.")]
public sealed partial class GoogleAuthService(HttpClient http)
{
    private readonly HttpClient _http = http;

    /// <summary>Android asks for the Web client ID (the API's GOOGLE_CLIENT_ID); iOS uses its own iOS client ID.</summary>
    public static string ClientId =>
        DeviceInfo.Platform == DevicePlatform.iOS ? BuildSettings.GoogleIosClientId : BuildSettings.GoogleWebClientId;

    public static bool IsConfigured => ClientId.Length > 0;

    /// <summary>The Google ID token for the Bestowd API, or null if the user cancelled.</summary>
    public Task<string?> SignInAsync()
    {
        if (!IsConfigured) throw new GoogleSignInException("Google sign-in isn't set up in this build (missing client ID).");
        return PlatformSignInAsync(ClientId);
    }

#if !ANDROID
    private async Task<string?> PlatformSignInAsync(string clientId)
    {
        var request = GoogleSignIn.CreateRequest(clientId);
        WebAuthenticatorResult result;
        try
        {
            result = await WebAuthenticator.Default.AuthenticateAsync(new WebAuthenticatorOptions
            {
                Url = request.AuthorizeUrl,
                CallbackUrl = request.RedirectUri,
                PrefersEphemeralWebBrowserSession = false,
            });
        }
        catch (TaskCanceledException)
        {
            return null;
        }
        var code = GoogleSignIn.ParseCallback(result.Properties, request);
        return await GoogleSignIn.ExchangeCodeAsync(_http, clientId, code, request);
    }
#endif
}
