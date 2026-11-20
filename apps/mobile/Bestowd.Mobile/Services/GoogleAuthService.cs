using Bestowd.Core.Auth;

namespace Bestowd.Mobile.Services;

/// <summary>Google sign-in in the system browser (Custom Tabs / ASWebAuthenticationSession) with PKCE.</summary>
public sealed class GoogleAuthService(HttpClient http)
{
    public static string ClientId =>
        DeviceInfo.Platform == DevicePlatform.iOS ? BuildSettings.GoogleIosClientId : BuildSettings.GoogleAndroidClientId;

    public static bool IsConfigured => ClientId.Length > 0;

    /// <summary>The Google ID token for the Bestowd API, or null if the user cancelled.</summary>
    public async Task<string?> SignInAsync()
    {
        if (!IsConfigured) throw new GoogleSignInException("Google sign-in isn't set up in this build (missing client ID).");
        var request = GoogleSignIn.CreateRequest(ClientId);
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
        return await GoogleSignIn.ExchangeCodeAsync(http, ClientId, code, request);
    }
}
