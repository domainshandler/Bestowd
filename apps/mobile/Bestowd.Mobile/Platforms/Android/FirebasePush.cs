#if FIREBASE
using Android.App;
using Android.Content;
using Android.Gms.Extensions;
using Firebase.Messaging;
using Bestowd.Core.Auth;
using DevicePlatform = Bestowd.Core.Models.DevicePlatform;

namespace Bestowd.Mobile.Platforms.Android;

/// <summary>Gets this device's FCM token, asking for notification permission first (Android 13+).</summary>
public sealed class FirebasePushRegistration : IPushRegistration
{
    public DevicePlatform Platform => DevicePlatform.Android;

    public async Task<string?> GetTokenAsync()
    {
        if (OperatingSystem.IsAndroidVersionAtLeast(33))
        {
            var status = await Permissions.RequestAsync<Permissions.PostNotifications>();
            if (status != PermissionStatus.Granted) return null;
        }
        var token = await FirebaseMessaging.Instance.GetToken().AsAsync<Java.Lang.String>();
        return token?.ToString();
    }
}

/// <summary>Shows reminders that arrive while the app is open, and opens the person or family when tapped.</summary>
[Service(Exported = false)]
[IntentFilter(["com.google.firebase.MESSAGING_EVENT"])]
public sealed class BestowdMessagingService : FirebaseMessagingService
{
    private const string ChannelId = "reminders";

    public override void OnMessageReceived(RemoteMessage message)
    {
        base.OnMessageReceived(message);
        var notification = message.GetNotification();
        if (notification is null) return;

        var manager = (NotificationManager)GetSystemService(NotificationService)!;
        if (manager.GetNotificationChannel(ChannelId) is null)
            manager.CreateNotificationChannel(new NotificationChannel(ChannelId, "Reminders", NotificationImportance.Default));

        var open = new Intent(this, typeof(MainActivity));
        foreach (var (key, value) in message.Data) open.PutExtra(key, value);
        open.AddFlags(ActivityFlags.ClearTop | ActivityFlags.SingleTop);
        var pending = PendingIntent.GetActivity(this, 0, open, PendingIntentFlags.Immutable | PendingIntentFlags.UpdateCurrent);

        var built = new Notification.Builder(this, ChannelId)
            .SetContentTitle(notification.Title)
            .SetContentText(notification.Body)
            .SetSmallIcon(Resource.Mipmap.appicon)
            .SetAutoCancel(true)
            .SetContentIntent(pending)
            .Build();
        manager.Notify(Environment.TickCount, built);
    }

    /// <summary>A new token is registered the next time the user logs a gift or signs in.</summary>
    public override void OnNewToken(string token) => base.OnNewToken(token);
}
#endif
