using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;

namespace Bestowd.Core.ViewModels;

/// <summary>A photo on an idea or gift: take one, choose one, or remove it. Uploads as soon as it's picked.</summary>
public sealed partial class PhotoSlot(BestowdApi api, IPhotoSource? photos, Func<string> groupId) : ObservableObject
{
    [ObservableProperty, NotifyPropertyChangedFor(nameof(Source), nameof(HasPhoto), nameof(TakeText))] public partial string? Url { get; set; }
    [ObservableProperty] public partial bool IsBusy { get; private set; }
    [ObservableProperty] public partial string? Error { get; private set; }

    public string? Source => api.PhotoUri(Url);
    public bool HasPhoto => Url is not null;
    public bool CanPick => photos is not null;
    public string TakeText => HasPhoto ? "Retake" : "Take photo";

    [RelayCommand] public Task TakeAsync() => PickAsync(() => photos!.TakeAsync());
    [RelayCommand] public Task ChooseAsync() => PickAsync(() => photos!.ChooseAsync());
    [RelayCommand] public void Remove() => Url = null;

    private async Task PickAsync(Func<Task<byte[]?>> pick)
    {
        if (photos is null || IsBusy) return;
        Error = null;
        try
        {
            IsBusy = true;
            if (await pick() is not { Length: > 0 } jpeg) return;
            Url = await api.UploadPhotoAsync(groupId(), jpeg);
        }
        catch (Exception e) when (e is ApiException or HttpRequestException) { Error = "Couldn't upload the photo. Try again."; }
        catch (Exception e) when (e is PhotoAccessException or NotSupportedException) { Error = e.Message; }
        finally { IsBusy = false; }
    }
}

/// <summary>Thrown by the app's photo source when camera or photo access is refused.</summary>
public sealed class PhotoAccessException(string message) : Exception(message);
