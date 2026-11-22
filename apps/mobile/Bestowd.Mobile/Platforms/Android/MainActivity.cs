using Android.App;
using Android.Content;
using Android.Content.PM;
using Android.OS;

namespace Bestowd.Mobile;

// https://<LinkHost>/join/<token> invite links open the app (verified App Links need /.well-known/assetlinks.json on that host).
[Activity(Theme = "@style/Maui.SplashTheme", MainLauncher = true, LaunchMode = LaunchMode.SingleTask,
    ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode | ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
[IntentFilter([Intent.ActionView], Categories = [Intent.CategoryDefault, Intent.CategoryBrowsable],
    DataScheme = "https", DataHost = BuildSettings.LinkHost, DataPathPrefix = "/join/", AutoVerify = true)]
public class MainActivity : MauiAppCompatActivity
{
    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        HandleIntent(Intent);
    }

    protected override void OnNewIntent(Intent? intent)
    {
        base.OnNewIntent(intent);
        HandleIntent(intent);
    }

    private static void HandleIntent(Intent? intent)
    {
        if (intent?.Action == Intent.ActionView && intent.DataString is { } data && Uri.TryCreate(data, UriKind.Absolute, out var uri))
            _ = App.HandleLinkAsync(uri);
    }
}

