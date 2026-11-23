using Bestowd.Core.ViewModels;
using Microsoft.Maui.Graphics.Platform;

namespace Bestowd.Mobile.Services;

/// <summary>The camera and photo library. Photos are shrunk to 1600 px and re-encoded as JPEG, which drops location data.</summary>
public sealed class MauiPhotoSource : IPhotoSource
{
    public const float MaxSide = 1600;

    public async Task<byte[]?> TakeAsync()
    {
        if (!MediaPicker.Default.IsCaptureSupported) throw new NotSupportedException("This device has no camera.");
        if (await Permissions.RequestAsync<Permissions.Camera>() != PermissionStatus.Granted)
            throw new PhotoAccessException("Allow camera access in Settings to take photos.");
        var file = await MainThread.InvokeOnMainThreadAsync(() => MediaPicker.Default.CapturePhotoAsync());
        return file is null ? null : await ShrinkAsync(file);
    }

    public async Task<byte[]?> ChooseAsync()
    {
        var files = await MainThread.InvokeOnMainThreadAsync(() => MediaPicker.Default.PickPhotosAsync(new MediaPickerOptions { SelectionLimit = 1 }));
        return files?.FirstOrDefault() is { } file ? await ShrinkAsync(file) : null;
    }

    private static async Task<byte[]> ShrinkAsync(FileResult file)
    {
        await using var input = await file.OpenReadAsync();
        using var image = PlatformImage.FromStream(input);
        using var small = Math.Max(image.Width, image.Height) > MaxSide ? image.Downsize(MaxSide, disposeOriginal: false) : image;
        using var output = new MemoryStream();
        await small.SaveAsync(output, ImageFormat.Jpeg, 0.85f);
        return output.ToArray();
    }
}
