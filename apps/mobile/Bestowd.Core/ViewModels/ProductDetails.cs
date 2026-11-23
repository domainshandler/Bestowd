using CommunityToolkit.Mvvm.ComponentModel;
using Bestowd.Core.Api;

namespace Bestowd.Core.ViewModels;

/// <summary>The form fields product details can fill. The form keeps the values; this only sets them.</summary>
public sealed record ProductFields(Action<string> Title, Action<string> Brand, Action<string> Store, Action<string> Category,
    Action<string> Price, Action<string> Url, Func<string> CurrentUrl);

/// <summary>
/// What the gift and idea forms share about the item itself: its photo, filling details in from a link or the photo,
/// autofill on the item, brand, store and category, and reading a snapped photo once when the form opens.
/// </summary>
public sealed partial class ProductDetails : ObservableObject
{
    private bool _filling, _photoRead;

    public ProductDetails(BestowdApi api, IPhotoSource? photos, Func<string> groupId, ProductFields fields)
    {
        Photo = new PhotoSlot(api, photos, groupId);
        Capture = new CaptureHelper(api, groupId, new DraftTargets(
            fields.Title, fields.Brand, fields.Store, fields.Price, fields.Url, v => Photo.Url = v, fields.CurrentUrl, () => Photo.Url));
        TitleSuggest = new Suggester(api, groupId, "title", fields.Title);
        BrandSuggest = new Suggester(api, groupId, "brand", fields.Brand);
        StoreSuggest = new Suggester(api, groupId, "store", fields.Store);
        CategorySuggest = new Suggester(api, groupId, "category", fields.Category);
    }

    public PhotoSlot Photo { get; }
    public CaptureHelper Capture { get; }
    public Suggester TitleSuggest { get; }
    public Suggester BrandSuggest { get; }
    public Suggester StoreSuggest { get; }
    public Suggester CategorySuggest { get; }

    /// <summary>Opened from a snapped photo: the photo shows first and is read straight away when the group has AI.</summary>
    [ObservableProperty] public partial bool FromPhoto { get; private set; }

    public void StartFromPhoto(string photoUrl)
    {
        Photo.Url = photoUrl;
        FromPhoto = true;
    }

    /// <summary>Call when a field the user types in changes; suggests unless the form is filling itself in.</summary>
    public void Typed(Suggester field, string text)
    {
        if (!_filling) _ = field.UpdateAsync(text);
    }

    /// <summary>Fills the form from a saved gift or idea without popping up suggestions.</summary>
    public void FillQuietly(Action fill)
    {
        _filling = true;
        try { fill(); }
        finally { _filling = false; }
    }

    /// <summary>Starts checking whether the group can read photos. Pass the task to <see cref="ReadSnappedPhotoAsync"/>.</summary>
    public Task LoadAsync() => Capture.LoadAsync();

    /// <summary>After the form has loaded: reads a snapped photo once, when the group has AI.</summary>
    public async Task ReadSnappedPhotoAsync(Task loaded)
    {
        await loaded;
        if (!FromPhoto || _photoRead || !Capture.CanReadPhotos) return;
        _photoRead = true;
        await Capture.FromPhotoAsync();
    }
}
