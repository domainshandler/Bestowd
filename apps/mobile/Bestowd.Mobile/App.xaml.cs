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
        if (InviteToken(uri) is not { } token) return;
        PendingInviteToken = token;
        if (Shell.Current is AppShell shell && shell.IsReady) await shell.OpenPendingInviteAsync();
    }

    /// <summary>The invite token from https://&lt;host&gt;/join/&lt;token&gt; or bestowd://join/&lt;token&gt;; null for any other link.</summary>
    public static string? InviteToken(Uri uri)
    {
        var segments = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (uri.Scheme == "bestowd") return uri.Host == "join" && segments.Length == 1 ? segments[0] : null;
        return segments.Length == 2 && segments[0] == "join" ? segments[1] : null;
    }

    protected override async void OnAppLinkRequestReceived(Uri uri)
    {
        base.OnAppLinkRequestReceived(uri);
        await HandleLinkAsync(uri);
    }
}
