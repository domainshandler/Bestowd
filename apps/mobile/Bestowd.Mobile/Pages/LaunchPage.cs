using Bestowd.Core.Auth;
using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

/// <summary>Restores a saved session, then shows the tabs or sign-in.</summary>
public sealed class LaunchPage : ContentPage
{
    private readonly Session _session;

    public LaunchPage(Session session)
    {
        _session = session;
        Content = new ActivityIndicator { IsRunning = true, VerticalOptions = LayoutOptions.Center, HorizontalOptions = LayoutOptions.Center };
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        bool restored;
        try { restored = await _session.RestoreAsync(); }
        catch (HttpRequestException) { restored = false; }
        if (restored && Shell.Current is AppShell shell) await shell.ShowMainAsync();
        else await Shell.Current.GoToAsync(Routes.SignIn);
    }
}
