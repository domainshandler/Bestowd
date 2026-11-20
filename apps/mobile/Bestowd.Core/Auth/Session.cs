using Bestowd.Core.Api;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.Auth;

/// <summary>Registers this device for push. The app implements it with Firebase; without Firebase it does nothing.</summary>
public interface IPushRegistration
{
    /// <summary>The device's push token, asking for permission if needed; null if push is off or refused.</summary>
    Task<string?> GetTokenAsync();
    DevicePlatform Platform { get; }
}

public sealed class NoPush : IPushRegistration
{
    public Task<string?> GetTokenAsync() => Task.FromResult<string?>(null);
    public DevicePlatform Platform => DevicePlatform.Android;
}

/// <summary>The signed-in user: sign-in, restoring a saved session, and sign-out.</summary>
public sealed class Session(BestowdApi api, ITokenStore tokens, GroupState groups, IPushRegistration push, ISettingsStore settings)
{
    private const string PushTokenKey = "bestowd_push_token";

    public User? User { get; private set; }
    public bool IsSignedIn => User is not null;

    /// <summary>Restores a saved session. False when there is none or it has expired.</summary>
    public async Task<bool> RestoreAsync()
    {
        if (string.IsNullOrEmpty(await tokens.GetAsync())) return false;
        try
        {
            await LoadAsync();
            return true;
        }
        catch (ApiException e) when (e.IsUnauthorized)
        {
            await tokens.ClearAsync();
            return false;
        }
    }

    public async Task SignInWithGoogleAsync(string idToken)
    {
        await api.GoogleLoginAsync(idToken);
        await LoadAsync();
    }

    /// <summary>Reloads the user and their groups (after joining a group, for example).</summary>
    public async Task LoadAsync()
    {
        var me = await api.GetMeAsync();
        User = me.User;
        groups.Load(me);
    }

    /// <summary>Registers for push reminders. Called after the user has something to be reminded about.</summary>
    public async Task EnablePushAsync()
    {
        var token = await push.GetTokenAsync();
        if (string.IsNullOrEmpty(token)) return;
        await api.RegisterDeviceAsync(push.Platform, token);
        settings.Set(PushTokenKey, token);
    }

    public async Task SignOutAsync()
    {
        var pushToken = settings.Get(PushTokenKey);
        if (pushToken is not null)
        {
            try { await api.UnregisterDeviceAsync(pushToken); } catch (Exception e) when (e is ApiException or HttpRequestException) { /* signing out anyway */ }
            settings.Set(PushTokenKey, null);
        }
        await tokens.ClearAsync();
        groups.Clear();
        User = null;
    }
}
