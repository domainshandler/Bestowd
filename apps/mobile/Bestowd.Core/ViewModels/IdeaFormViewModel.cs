using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public sealed partial class IdeaFormViewModel(BestowdApi api, INavigator nav, DataChanged changes, QuickAdd? quickAdd = null, IPhotoSource? photos = null) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private ProductDetails? _product;

    /// <summary>The item's photo, filling in from a link or photo, and autofill on its text fields.</summary>
    public ProductDetails Product => _product ??= new ProductDetails(api, photos, () => _groupId, new ProductFields(
        v => Title = v, v => Brand = v, v => Store = v, v => Category = v, v => Price = v, v => Url = v, () => Url));
    partial void OnTitleChanged(string value) => Product.Typed(Product.TitleSuggest, value);
    partial void OnBrandChanged(string value) => Product.Typed(Product.BrandSuggest, value);
    partial void OnStoreChanged(string value) => Product.Typed(Product.StoreSuggest, value);
    partial void OnCategoryChanged(string value) => Product.Typed(Product.CategorySuggest, value);

    private string _groupId = "";
    private string? _personId, _occasionId;
    private Idea? _idea;

    /// <summary>Set when editing a saved idea.</summary>
    [ObservableProperty, NotifyPropertyChangedFor(nameof(ScreenTitle))] public partial string? IdeaId { get; private set; }
    public string ScreenTitle => IdeaId is null ? "Add an idea" : "Edit idea";
    [ObservableProperty][NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Title { get; set; } = "";
    [ObservableProperty] public partial string Brand { get; set; } = "";
    [ObservableProperty] public partial string Store { get; set; } = "";
    [ObservableProperty] public partial string Category { get; set; } = "";
    [ObservableProperty] public partial string Price { get; set; } = "";
    [ObservableProperty] public partial string Url { get; set; } = "";
    [ObservableProperty] public partial string AgeMin { get; set; } = "";
    [ObservableProperty] public partial string AgeMax { get; set; } = "";
    [ObservableProperty] public partial string Notes { get; set; } = "";
    private RecipientPicker? _people;

    /// <summary>Who the idea is for: search and add people rather than toggling everyone, or add someone new.</summary>
    public RecipientPicker People
    {
        get
        {
            if (_people is not null) return _people;
            _people = new RecipientPicker();
            if (quickAdd is not null) _people.AddNew = name => quickAdd.AddAsync(_groupId, name, allowFamily: false);
            return _people;
        }
    }

    public void Apply(IDictionary<string, object> parameters)
    {
        _groupId = Params.Get(parameters, Params.GroupId) ?? "";
        _personId = Params.Get(parameters, Params.PersonId);
        _occasionId = Params.Get(parameters, Params.OccasionId);
        IdeaId = Params.Get(parameters, Params.Id);
        if (Params.Get(parameters, Params.PhotoUrl) is { } photo) Product.StartFromPhoto(photo);
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        var ai = Product.LoadAsync();
        await RunAsync(async () =>
        {
            var people = api.ListPeopleAsync(_groupId);
            if (IdeaId is not null && _idea is null) Fill(_idea = await api.GetIdeaAsync(IdeaId));
            var options = SubjectOption.Build(await people, []);
            var tagged = _idea?.People.Select(p => p.Id).ToHashSet() ?? (_personId is null ? [] : [_personId]);
            People.SetOptions(options, options.Where(o => o.PersonId is { } id && tagged.Contains(id)));
        });
        await Product.ReadSnappedPhotoAsync(ai);
    }

    private void Fill(Idea i)
    {
        Product.FillQuietly(() =>
        {
            Title = i.Title;
            Brand = i.Brand ?? "";
            Store = i.Store ?? "";
            Category = i.Category ?? "";
            Price = i.Price?.ToString(CultureInfo.CurrentCulture) ?? "";
            Url = i.Url ?? "";
            AgeMin = i.AgeMin?.ToString(CultureInfo.CurrentCulture) ?? "";
            AgeMax = i.AgeMax?.ToString(CultureInfo.CurrentCulture) ?? "";
            Notes = i.Notes ?? "";
        });
        Product.Photo.Url = i.ImageUrl;
    }

    private bool CanSave() => Title.Trim().Length > 0;

    public CreateIdeaBody? BuildBody()
    {
        decimal? price = null; int? min = null, max = null;
        if (!Validate(() =>
        {
            price = ParseMoney(Price);
            min = ParseInt(AgeMin, 0, 120, "Age");
            max = ParseInt(AgeMax, 0, 120, "Age");
            if (min > max) throw new FormException("The first age can't be above the second.");
            CheckLink(Url);
        })) return null;
        string? Text(string s) => s.Trim() is { Length: > 0 } t ? t : null;
        return new CreateIdeaBody
        {
            Title = Title.Trim(),
            Brand = Text(Brand),
            Store = Text(Store),
            Category = Text(Category),
            Price = price,
            Url = Text(Url),
            Notes = Text(Notes),
            ImageUrl = Product.Photo.Url,
            AgeMin = min,
            AgeMax = max,
            OccasionId = _occasionId,
            PersonIds = People.ChosenPersonIds.ToList(),
        };
    }

    [RelayCommand(CanExecute = nameof(CanSave))]
    public Task SaveAsync()
    {
        if (BuildBody() is not { } body) return Task.CompletedTask;
        if (IdeaId is null) return SaveAndCloseAsync(() => api.CreateIdeaAsync(_groupId, body));
        var patch = new Patch().Set("title", body.Title).Set("brand", body.Brand).Set("store", body.Store).Set("category", body.Category)
            .Set("price", body.Price).Set("url", body.Url).Set("imageUrl", body.ImageUrl).Set("notes", body.Notes)
            .Set("ageMin", body.AgeMin).Set("ageMax", body.AgeMax).Set("personIds", body.PersonIds ?? []);
        return SaveAndCloseAsync(() => api.UpdateIdeaAsync(IdeaId, patch));
    }
}
