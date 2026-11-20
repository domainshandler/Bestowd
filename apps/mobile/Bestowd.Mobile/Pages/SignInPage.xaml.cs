using Bestowd.Core.Api;
using Bestowd.Core.Auth;
using Bestowd.Mobile.Services;

namespace Bestowd.Mobile.Pages;

public partial class SignInPage : ContentPage
{
    private readonly Session _session;
    private readonly GoogleAuthService _google;

    public SignInPage(Session session, GoogleAuthService google)
    {
        InitializeComponent();
        _session = session;
        _google = google;
    }

    private async void OnGoogleClicked(object? sender, EventArgs e)
    {
        SetBusy(true);
        try
        {
            var idToken = await _google.SignInAsync();
            if (idToken is null) return;
            await _session.SignInWithGoogleAsync(idToken);
            if (Shell.Current is AppShell shell) await shell.ShowMainAsync();
        }
        catch (Exception ex) when (ex is GoogleSignInException or ApiException or HttpRequestException)
        {
            ErrorLabel.Text = ex is HttpRequestException ? "Can't reach Bestowd. Check your connection." : ex.Message;
            ErrorLabel.IsVisible = true;
        }
        finally
        {
            SetBusy(false);
        }
    }

    private void SetBusy(bool busy)
    {
        GoogleButton.IsEnabled = !busy;
        Busy.IsVisible = Busy.IsRunning = busy;
        if (busy) ErrorLabel.IsVisible = false;
    }
}
