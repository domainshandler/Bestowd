using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>The form fields capture can fill, and whether the form already has a link or photo.</summary>
public sealed record DraftTargets(Action<string> Title, Action<string> Brand, Action<string> Store, Action<string> Price,
    Action<string> Url, Action<string> Photo, Func<string> CurrentUrl, Func<string?> CurrentPhoto);

/// <summary>"Fill in from link" and "Fill in from photo" on the idea and gift forms.</summary>
public sealed partial class CaptureHelper(BestowdApi api, Func<string> groupId, DraftTargets targets) : ObservableObject
{
    [ObservableProperty] public partial bool IsBusy { get; private set; }
    [ObservableProperty] public partial string? Note { get; private set; }
    [ObservableProperty] public partial string? Error { get; private set; }
    /// <summary>The group has an AI key, so photos can be read.</summary>
    [ObservableProperty] public partial bool CanReadPhotos { get; private set; }

    public async Task LoadAsync()
    {
        try { CanReadPhotos = (await api.GetAiSettingsAsync(groupId())).Configured; }
        catch (Exception e) when (e is ApiException or HttpRequestException) { CanReadPhotos = false; }
    }

    /// <summary>Fills what the draft found and leaves the rest as typed. Returns the note shown under the buttons.</summary>
    public static string Apply(ProductDraft d, DraftTargets t)
    {
        var filled = new List<string>();
        if (d.Title is { Length: > 0 } title) { t.Title(title); filled.Add("name"); }
        if (d.Brand is { Length: > 0 } brand) { t.Brand(brand); filled.Add("brand"); }
        if (d.Store is { Length: > 0 } store) { t.Store(store); filled.Add("store"); }
        if (d.Price is { } price) { t.Price(price.ToString(CultureInfo.CurrentCulture)); filled.Add("price"); }
        if (d.Url is { Length: > 0 } url && t.CurrentUrl().Trim().Length == 0) t.Url(url);
        if (d.ImageUrl is { Length: > 0 } image && t.CurrentPhoto() is null) { t.Photo(image); filled.Add("picture"); }
        if (filled.Count == 0) return "Couldn't find any details. Fill them in yourself.";
        var currency = d.Price is { } p && d.Currency is { } c ? $" Price read as {p.ToString(CultureInfo.CurrentCulture)} {c}." : "";
        return $"Filled in the {string.Join(", ", filled)}. Check before saving.{currency}";
    }

    private async Task RunAsync(Func<Task<ProductDraft>> read)
    {
        if (IsBusy) return;
        Error = null; Note = null;
        try
        {
            IsBusy = true;
            Note = Apply(await read(), targets);
        }
        catch (ApiException e) { Error = e.Message; }
        catch (HttpRequestException) { Error = "Couldn't reach Bestowd. Try again."; }
        finally { IsBusy = false; }
    }

    [RelayCommand]
    public Task FromLinkAsync()
    {
        var url = targets.CurrentUrl().Trim();
        if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase)) { Error = "Paste a link starting with https:// first."; return Task.CompletedTask; }
        return RunAsync(() => api.CaptureLinkAsync(groupId(), url));
    }

    [RelayCommand]
    public Task FromPhotoAsync() => targets.CurrentPhoto() is { } photo && photo.StartsWith("/files/", StringComparison.Ordinal)
        ? RunAsync(() => api.CapturePhotoAsync(groupId(), photo))
        : Task.CompletedTask;
}
