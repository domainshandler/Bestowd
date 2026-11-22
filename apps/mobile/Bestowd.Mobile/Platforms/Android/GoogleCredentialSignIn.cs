using AndroidX.Core.Content;
using AndroidX.Credentials;
using AndroidX.Credentials.Exceptions;
using Bestowd.Core.Auth;
using Google.Android.Libraries.Identity.GoogleId;

namespace Bestowd.Mobile.Services;

/// <summary>
/// Android sign-in through Credential Manager: the "Sign in with Google" sheet returns a Google ID token
/// issued for the Web client ID. Google matches the app to its Android OAuth client by package name and signing SHA-1.
/// </summary>
public sealed partial class GoogleAuthService
{
    private static async Task<string?> PlatformSignInAsync(string webClientId)
    {
        var activity = Platform.CurrentActivity ?? throw new GoogleSignInException("Sign-in needs the app to be open.");
        var option = new GetSignInWithGoogleOption.Builder(webClientId).Build();
        var request = new GetCredentialRequest.Builder().AddCredentialOption(option).Build();

        var callback = new CredentialCallback();
        CredentialManager.Create(activity).GetCredentialAsync(activity, request, null, ContextCompat.GetMainExecutor(activity)!, callback);
        var response = await callback.Task;
        if (response is null) return null;

        if (response.Credential is CustomCredential custom
            && (custom.Type == GoogleIdTokenCredential.TypeGoogleIdTokenCredential || custom.Type == GoogleIdTokenCredential.TypeGoogleIdTokenSiwgCredential))
        {
            try
            {
                return GoogleIdTokenCredential.CreateFrom(custom.Data).IdToken;
            }
            catch (GoogleIdTokenParsingException)
            {
                throw new GoogleSignInException("Google returned a sign-in we couldn't read.");
            }
        }
        throw new GoogleSignInException("Google didn't return a sign-in.");
    }

    /// <summary>Completes a task from Credential Manager's callback. Null means the user cancelled.</summary>
    private sealed class CredentialCallback : Java.Lang.Object, ICredentialManagerCallback
    {
        private readonly TaskCompletionSource<GetCredentialResponse?> _tcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Task<GetCredentialResponse?> Task => _tcs.Task;

        public void OnResult(Java.Lang.Object? result) => _tcs.TrySetResult((GetCredentialResponse?)result);

        public void OnError(Java.Lang.Object e)
        {
            // The binding hands errors over as plain Java objects; wrap the handle as the Throwable it is.
            switch (Java.Lang.Object.GetObject<Java.Lang.Throwable>(e.Handle, Android.Runtime.JniHandleOwnership.DoNotTransfer))
            {
                case GetCredentialCancellationException:
                    _tcs.TrySetResult(null);
                    break;
                case NoCredentialException:
                    _tcs.TrySetException(new GoogleSignInException("No Google account is available on this device. Add one in Settings, then try again."));
                    break;
                case GetCredentialException g:
                    _tcs.TrySetException(new GoogleSignInException($"Google sign-in failed: {g.ErrorMessage ?? g.Message}"));
                    break;
                default:
                    _tcs.TrySetException(new GoogleSignInException("Google sign-in failed."));
                    break;
            }
        }
    }
}
