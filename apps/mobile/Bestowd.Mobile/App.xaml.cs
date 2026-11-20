using Bestowd.Core.Api;
using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile;

public partial class App : Application
{
    private readonly IServiceProvider _services;

    public App(IServiceProvider services, BestowdApi api)
    {
        InitializeComponent();
        _services = services;
        // An expired session anywhere sends the user back to sign-in.
        api.Unauthorized += (_, _) => MainThread.BeginInvokeOnMainThread(async () =>
        {
            if (Shell.Current?.CurrentState.Location.OriginalString.Contains("signin") == false)
                await Shell.Current.GoToAsync(Routes.SignIn);
        });
    }

    /// <summary>An invite link opened before sign-in; handled once signed in.</summary>
    public static string? PendingInviteToken { get; set; }

    protected override Window CreateWindow(IActivationState? activationState) => new(new AppShell(_services));

    /// <summary>Opens https://…/join/&lt;token&gt; links (Android App Links, iOS Universal Links).</summary>
    public static async Task HandleLinkAsync(Uri uri)
    {
        var segments = uri.AbsolutePath.Trim('/').Split('/');
        if (segments.Length != 2 || segments[0] != "join" || string.IsNullOrEmpty(segments[1])) return;
        PendingInviteToken = segments[1];
        if (Shell.Current is AppShell shell && shell.IsReady) await shell.OpenPendingInviteAsync();
    }

    protected override async void OnAppLinkRequestReceived(Uri uri)
    {
        base.OnAppLinkRequestReceived(uri);
        await HandleLinkAsync(uri);
    }
}
