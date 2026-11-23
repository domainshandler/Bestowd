using Bestowd.Core.Api;
using Bestowd.Core.Groups;
using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Services;

/// <summary>The session token, kept in the platform keychain / keystore.</summary>
public sealed class SecureTokenStore : ITokenStore
{
    private const string Key = "bestowd_token";
    public Task<string?> GetAsync() => SecureStorage.Default.GetAsync(Key);
    public Task SetAsync(string token) => SecureStorage.Default.SetAsync(Key, token);
    public Task ClearAsync() { SecureStorage.Default.Remove(Key); return Task.CompletedTask; }
}

public sealed class PreferencesSettingsStore : ISettingsStore
{
    public string? Get(string key) => Preferences.Default.Get<string?>(key, null);
    public void Set(string key, string? value)
    {
        if (value is null) Preferences.Default.Remove(key);
        else Preferences.Default.Set(key, value);
    }
}

public sealed class ShellNavigator : INavigator
{
    public Task GoToAsync(string route, IDictionary<string, object>? parameters = null) =>
        MainThread.InvokeOnMainThreadAsync(() => parameters is null
            ? Shell.Current.GoToAsync(route)
            : Shell.Current.GoToAsync(route, new ShellNavigationQueryParameters(parameters)));

    public Task GoBackAsync() => MainThread.InvokeOnMainThreadAsync(() => Shell.Current.GoToAsync(".."));
}

public sealed class MauiPrompts : IPrompts
{
    private static Page Page => Shell.Current.CurrentPage;

    public Task<bool> ConfirmAsync(string title, string message, string accept, string cancel = "Cancel") =>
        MainThread.InvokeOnMainThreadAsync(() => Page.DisplayAlertAsync(title, message, accept, cancel));

    public Task AlertAsync(string title, string message) =>
        MainThread.InvokeOnMainThreadAsync(() => Page.DisplayAlertAsync(title, message, "OK"));

    /// <summary>The native share sheet, so links go out by WhatsApp, text or anything else installed.</summary>
    public Task ShareAsync(string title, string text) =>
        Share.Default.RequestAsync(new ShareTextRequest { Title = title, Text = text });

    public Task<string?> ChooseAsync(string title, IReadOnlyList<string> options) =>
        MainThread.InvokeOnMainThreadAsync(async () =>
        {
            var picked = await Page.DisplayActionSheetAsync(title, "Cancel", null, options.ToArray());
            return picked is null || picked == "Cancel" ? null : picked;
        });

    public Task<string?> AskTextAsync(string title, string message, string placeholder) =>
        MainThread.InvokeOnMainThreadAsync(() => Page.DisplayPromptAsync(title, message, "OK", "Cancel", placeholder, maxLength: 100));
}
