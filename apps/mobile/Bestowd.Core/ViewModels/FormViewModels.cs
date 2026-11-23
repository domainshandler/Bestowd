using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Auth;
using Bestowd.Core.Formatting;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>Shared save flow: validate, call the API, tell open screens, go back.</summary>
public abstract partial class FormViewModel(INavigator nav, DataChanged changes) : ViewModelBase
{
    protected INavigator Nav { get; } = nav;

    protected async Task SaveAndCloseAsync(Func<Task> save)
    {
        if (await RunAsync(save))
        {
            changes.Notify();
            await Nav.GoBackAsync();
        }
    }

    [RelayCommand] public Task CancelAsync() => Nav.GoBackAsync();

    /// <summary>A product link must be a web address.</summary>
    protected static void CheckLink(string? text)
    {
        if (text?.Trim() is { Length: > 0 } u && !(u.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || u.StartsWith("http://", StringComparison.OrdinalIgnoreCase)))
            throw new FormException("Links start with https://");
    }

    protected static decimal? ParseMoney(string? text) =>
        string.IsNullOrWhiteSpace(text) ? null
        : decimal.TryParse(text, NumberStyles.Number, CultureInfo.CurrentCulture, out var d) && d >= 0 ? d
        : throw new FormException("Enter an amount like 25 or 24.50.");

    protected static int? ParseInt(string? text, int min, int max, string what) =>
        string.IsNullOrWhiteSpace(text) ? null
        : int.TryParse(text, out var n) && n >= min && n <= max ? n
        : throw new FormException($"{what} must be between {min} and {max}.");

    /// <summary>Validation failure shown as the form's error.</summary>
    protected sealed class FormException(string message) : Exception(message);

    protected bool Validate(Action check)
    {
        try { check(); Error = null; return true; }
        catch (FormException e) { Error = e.Message; return false; }
    }
}

// ---------------- Family ----------------

public sealed partial class FamilyFormViewModel(BestowdApi api, INavigator nav, DataChanged changes) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private string _groupId = "";
    [ObservableProperty] public partial string? FamilyId { get; private set; }
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Name { get; set; } = "";
    [ObservableProperty] public partial FamilyType Type { get; set; } = FamilyType.Family;
    [ObservableProperty] public partial string Notes { get; set; } = "";

    public IReadOnlyList<FamilyType> Types { get; } = Enum.GetValues<FamilyType>();
    public string Title => FamilyId is null ? "Add family" : "Edit family";

    public void Apply(IDictionary<string, object> p)
    {
        _groupId = Params.Get(p, Params.GroupId) ?? "";
        FamilyId = Params.Get(p, Params.Id);
        OnPropertyChanged(nameof(Title));
    }

    [RelayCommand]
    public Task LoadAsync() => FamilyId is null ? Task.CompletedTask : RunAsync(async () =>
    {
        var f = await api.GetFamilyAsync(FamilyId);
        Name = f.Name; Type = f.Type; Notes = f.Notes ?? "";
    });

    private bool CanSave() => Name.Trim().Length > 0;

    [RelayCommand(CanExecute = nameof(CanSave))]
    public Task SaveAsync() => SaveAndCloseAsync(() => FamilyId is null
        ? api.CreateFamilyAsync(_groupId, new CreateFamilyBody { Name = Name.Trim(), Type = Type, Notes = Notes.Trim() is { Length: > 0 } n ? n : null })
        : api.UpdateFamilyAsync(FamilyId, new Patch().Set("name", Name.Trim()).SetEnum("type", Type).Set("notes", Notes.Trim() is { Length: > 0 } n2 ? n2 : null)));
}

// ---------------- Person ----------------

public sealed partial class PersonFormViewModel(BestowdApi api, INavigator nav, DataChanged changes) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private Dictionary<string, string> _otherSizes = [];
    [ObservableProperty] public partial string FamilyId { get; private set; } = "";
    [ObservableProperty] public partial string? PersonId { get; private set; }
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Name { get; set; } = "";
    [ObservableProperty] public partial string Relationship { get; set; } = "";
    /// <summary>0 = unknown, else 1–12.</summary>
    [ObservableProperty] public partial int BirthMonth { get; set; }
    [ObservableProperty] public partial string BirthDay { get; set; } = "";
    [ObservableProperty] public partial string BirthYear { get; set; } = "";
    [ObservableProperty] public partial string Likes { get; set; } = "";
    [ObservableProperty] public partial string Avoid { get; set; } = "";
    [ObservableProperty] public partial string ClothingSize { get; set; } = "";
    [ObservableProperty] public partial string ShoeSize { get; set; } = "";
    [ObservableProperty] public partial string FoodNotes { get; set; } = "";
    [ObservableProperty] public partial string Notes { get; set; } = "";

    public IReadOnlyList<string> Months { get; } = ["Month", .. CultureInfo.InvariantCulture.DateTimeFormat.MonthNames.Take(12)];
    public string Title => PersonId is null ? "Add person" : $"Edit {Name}";

    public void Apply(IDictionary<string, object> p)
    {
        FamilyId = Params.Get(p, Params.FamilyId) ?? "";
        PersonId = Params.Get(p, Params.Id);
        OnPropertyChanged(nameof(Title));
    }

    [RelayCommand]
    public Task LoadAsync() => PersonId is null ? Task.CompletedTask : RunAsync(async () =>
    {
        var x = await api.GetPersonAsync(PersonId);
        Name = x.Name; Relationship = x.Relationship ?? ""; BirthMonth = x.BirthMonth ?? 0;
        BirthDay = x.BirthDay?.ToString(CultureInfo.CurrentCulture) ?? ""; BirthYear = x.BirthYear?.ToString(CultureInfo.CurrentCulture) ?? "";
        Likes = string.Join(", ", x.Likes); Avoid = string.Join(", ", x.Avoid);
        ClothingSize = x.Sizes.GetValueOrDefault("Clothing") ?? ""; ShoeSize = x.Sizes.GetValueOrDefault("Shoes") ?? "";
        _otherSizes = x.Sizes.Where(kv => kv.Key is not ("Clothing" or "Shoes")).ToDictionary();
        FoodNotes = x.FoodNotes ?? ""; Notes = x.Notes ?? "";
        OnPropertyChanged(nameof(Title));
    });

    private bool CanSave() => Name.Trim().Length > 0;

    public Dictionary<string, string> Sizes()
    {
        var sizes = new Dictionary<string, string>(_otherSizes);
        if (ClothingSize.Trim() is { Length: > 0 } c) sizes["Clothing"] = c;
        if (ShoeSize.Trim() is { Length: > 0 } s) sizes["Shoes"] = s;
        return sizes;
    }

    [RelayCommand(CanExecute = nameof(CanSave))]
    public async Task SaveAsync()
    {
        int? day = null, year = null;
        if (!Validate(() =>
        {
            day = BirthMonth == 0 ? null : ParseInt(BirthDay, 1, 31, "Day");
            year = ParseInt(BirthYear, 1900, DateTime.UtcNow.Year, "Year");
        })) return;
        string? Text(string s) => s.Trim() is { Length: > 0 } t ? t : null;
        int? month = BirthMonth == 0 ? null : BirthMonth;

        await SaveAndCloseAsync(() => PersonId is null
            ? api.CreatePersonAsync(FamilyId, new PersonBody
            {
                Name = Name.Trim(), Relationship = Text(Relationship), BirthMonth = month, BirthDay = day, BirthYear = year,
                Likes = Format.SplitList(Likes), Avoid = Format.SplitList(Avoid), Sizes = Sizes(), FoodNotes = Text(FoodNotes), Notes = Text(Notes),
            })
            : api.UpdatePersonAsync(PersonId, new Patch()
                .Set("name", Name.Trim()).Set("relationship", Text(Relationship))
                .Set("birthMonth", month).Set("birthDay", day).Set("birthYear", year)
                .Set("likes", Format.SplitList(Likes)).Set("avoid", Format.SplitList(Avoid)).Set("sizes", Sizes())
                .Set("foodNotes", Text(FoodNotes)).Set("notes", Text(Notes))));
    }
}

// ---------------- Occasion ----------------

public sealed partial class OccasionFormViewModel(BestowdApi api, INavigator nav, DataChanged changes) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private string _groupId = "";
    [ObservableProperty] public partial string? FixedPersonId { get; private set; }
    [ObservableProperty] public partial string? FixedFamilyId { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<SubjectOption> Subjects { get; private set; } = [];
    [ObservableProperty] public partial SubjectOption? Subject { get; set; }
    [ObservableProperty] public partial OccasionType Type { get; set; } = OccasionType.Birthday;
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Name { get; set; } = "";
    [ObservableProperty] public partial DateTime Date { get; set; } = DateTime.Today;
    [ObservableProperty] public partial bool RecursAnnually { get; set; } = true;
    [ObservableProperty] public partial string Budget { get; set; } = "";
    [ObservableProperty] public partial bool NeedsCard { get; set; }
    [ObservableProperty] public partial string Location { get; set; } = "";
    [ObservableProperty] public partial string HostGiftRequest { get; set; } = "";

    public IReadOnlyList<OccasionType> Types { get; } = Enum.GetValues<OccasionType>();
    public bool ChoosesSubject => FixedPersonId is null && FixedFamilyId is null;

    partial void OnTypeChanged(OccasionType value) => RecursAnnually = value != OccasionType.OneOff;

    public void Apply(IDictionary<string, object> p)
    {
        _groupId = Params.Get(p, Params.GroupId) ?? "";
        FixedPersonId = Params.Get(p, Params.PersonId);
        FixedFamilyId = FixedPersonId is null ? Params.Get(p, Params.FamilyId) : null;
        if (Params.Get(p, Params.SubjectName) is { } name) Name = $"{name}'s birthday";
        OnPropertyChanged(nameof(ChoosesSubject));
    }

    [RelayCommand]
    public Task LoadAsync() => !ChoosesSubject ? Task.CompletedTask : RunAsync(async () =>
    {
        var people = api.ListPeopleAsync(_groupId);
        var families = api.ListFamiliesAsync(_groupId);
        Subjects = SubjectOption.Build(await people, await families);
    });

    private bool CanSave() => Name.Trim().Length > 0;

    public CreateOccasionBody? BuildBody()
    {
        decimal? budget = null;
        if (!Validate(() => budget = ParseMoney(Budget))) return null;
        var personId = FixedPersonId ?? Subject?.PersonId;
        var familyId = FixedFamilyId ?? Subject?.FamilyId;
        if (personId is null && familyId is null) { Error = "Choose who it's for."; return null; }
        string? Text(string s) => s.Trim() is { Length: > 0 } t ? t : null;
        return new CreateOccasionBody
        {
            Type = Type, Name = Name.Trim(), Date = DateOnly.FromDateTime(Date).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            PersonId = personId, FamilyId = personId is null ? familyId : null,
            RecursAnnually = RecursAnnually, Budget = budget, NeedsCard = NeedsCard,
            Location = Text(Location), HostGiftRequest = Text(HostGiftRequest),
        };
    }

    [RelayCommand(CanExecute = nameof(CanSave))]
    public Task SaveAsync() => BuildBody() is { } body ? SaveAndCloseAsync(() => api.CreateOccasionAsync(_groupId, body)) : Task.CompletedTask;
}

// ---------------- Gift ----------------

/// <summary>Log a given or received gift, or edit one.</summary>
public sealed partial class LogGiftViewModel(BestowdApi api, GroupState groups, Session session, INavigator nav, DataChanged changes, QuickAdd? quickAdd = null, IPhotoSource? photos = null) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private RecipientPicker? _who;
    private PhotoSlot? _photo;

    public PhotoSlot Photo => _photo ??= new PhotoSlot(api, photos, () => _groupId);

    private CaptureHelper? _capture;
    public CaptureHelper Capture => _capture ??= new CaptureHelper(api, () => _groupId, new DraftTargets(
        v => Title = v, v => Brand = v, v => Store = v, v => Amount = v, v => Url = v, v => Photo.Url = v, () => Url, () => Photo.Url));

    private Suggester? _titleS, _brandS, _storeS, _categoryS;
    public Suggester TitleSuggest => _titleS ??= new Suggester(api, () => _groupId, "title", v => Title = v);
    public Suggester BrandSuggest => _brandS ??= new Suggester(api, () => _groupId, "brand", v => Brand = v);
    public Suggester StoreSuggest => _storeS ??= new Suggester(api, () => _groupId, "store", v => Store = v);
    public Suggester CategorySuggest => _categoryS ??= new Suggester(api, () => _groupId, "category", v => Category = v);
    // Suggest only while the user is typing, not when a saved gift or idea is loaded.
    private bool _loading = false;
    partial void OnTitleChanged(string value) { if (!_loading) _ = TitleSuggest.UpdateAsync(value); }
    partial void OnBrandChanged(string value) { if (!_loading) _ = BrandSuggest.UpdateAsync(value); }
    partial void OnStoreChanged(string value) { if (!_loading) _ = StoreSuggest.UpdateAsync(value); }
    partial void OnCategoryChanged(string value) { if (!_loading) _ = CategorySuggest.UpdateAsync(value); }



    /// <summary>Who the gift is to or from: a type-to-search picker over people and families, with "+ Add".</summary>
    public RecipientPicker Who
    {
        get
        {
            if (_who is not null) return _who;
            _who = new RecipientPicker(includeFamilies: true, single: true);
            if (quickAdd is not null) _who.AddNew = name => quickAdd.AddAsync(_groupId, name, allowFamily: true);
            _who.Changed += (_, _) => { if (Subject != _who.Chosen.FirstOrDefault()) Subject = _who.Chosen.FirstOrDefault(); };
            return _who;
        }
    }

    private string _groupId = "";
    private string? _defaultPersonId, _defaultFamilyId;
    private string? _ideaId;
    private bool _ideaFilled, _photoRead;

    [ObservableProperty] public partial string? GiftId { get; private set; }
    /// <summary>Opened from a snapped photo: the photo shows first and is read straight away when the group has AI.</summary>
    [ObservableProperty] public partial bool FromPhoto { get; private set; }
    [ObservableProperty] public partial bool IsReceived { get; set; }
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Title { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyList<SubjectOption> Subjects { get; private set; } = [];
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial SubjectOption? Subject { get; set; }
    [ObservableProperty] public partial IReadOnlyList<Occasion> Occasions { get; private set; } = [];
    [ObservableProperty] public partial Occasion? Occasion { get; set; }
    [ObservableProperty] public partial DateTime Date { get; set; } = DateTime.Today;
    [ObservableProperty] public partial string Amount { get; set; } = "";
    [ObservableProperty] public partial string Category { get; set; } = "";
    [ObservableProperty] public partial string Brand { get; set; } = "";
    [ObservableProperty] public partial string Store { get; set; } = "";
    [ObservableProperty] public partial string Url { get; set; } = "";
    [ObservableProperty] public partial bool BoughtNotGiven { get; set; }
    [ObservableProperty] public partial bool ValueHidden { get; set; } = true;
    [ObservableProperty] public partial bool HasGiftReceipt { get; set; }
    [ObservableProperty] public partial bool ThankYouSent { get; set; }
    [ObservableProperty] public partial string Notes { get; set; } = "";

    public string ScreenTitle => GiftId is null ? "Log a gift" : "Edit gift";
    public string SubjectLabel => IsReceived ? "From" : "To";
    public string AmountLabel => IsReceived ? "Estimated value" : "Price";

    partial void OnIsReceivedChanged(bool value) { OnPropertyChanged(nameof(SubjectLabel)); OnPropertyChanged(nameof(AmountLabel)); }
    partial void OnSubjectChanged(SubjectOption? value)
    {
        if (Who.Chosen.FirstOrDefault() != value) Who.SetChosen(value);
        LoadOccasionsCommand.Execute(null);
    }

    partial void OnSubjectsChanged(IReadOnlyList<SubjectOption> value) => Who.SetOptions(value, Subject is null ? [] : [Subject]);

    /// <summary>Picking an occasion first fills in who it's for, when it belongs to one person or family.</summary>
    partial void OnOccasionChanged(Occasion? value)
    {
        if (Subject is not null || value is null || value.IsGroupWide) return;
        Subject = Subjects.FirstOrDefault(s => value.PersonId is { } p ? s.PersonId == p : s.PersonId is null && s.FamilyId == value.FamilyId);
    }

    public void Apply(IDictionary<string, object> p)
    {
        _groupId = Params.Get(p, Params.GroupId) ?? groups.GroupId ?? "";
        GiftId = Params.Get(p, Params.Id);
        _defaultPersonId = Params.Get(p, Params.PersonId);
        _defaultFamilyId = Params.Get(p, Params.FamilyId);
        _pendingOccasionId = Params.Get(p, Params.OccasionId);
        IsReceived = Params.Get(p, Params.Direction) == "RECEIVED";
        _ideaId = Params.Get(p, Params.IdeaId);
        if (Params.Get(p, Params.PhotoUrl) is { } photo) { Photo.Url = photo; FromPhoto = true; }
        OnPropertyChanged(nameof(ScreenTitle));
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        var ai = Capture.LoadAsync();
        var loaded = await RunAsync(async () =>
        {
            var people = api.ListPeopleAsync(_groupId);
            var families = api.ListFamiliesAsync(_groupId);
            Subjects = SubjectOption.Build(await people, await families);
            if (GiftId is not null)
            {
                Fill(await api.GetGiftAsync(GiftId));
            }
            else if (_ideaId is not null && !_ideaFilled)
            {
                FillFromIdea(await api.GetIdeaAsync(_ideaId));
                _ideaFilled = true;
            }
            else if (_ideaId is null) Subject = Subjects.FirstOrDefault(s => (_defaultPersonId is not null && s.PersonId == _defaultPersonId) || (_defaultPersonId is null && _defaultFamilyId is not null && s.FamilyId == _defaultFamilyId));
        });
        // Setting Subject above can't load occasions while this load is still busy, so load them now.
        if (loaded) await LoadOccasionsAsync();
        await ai;
        if (FromPhoto && !_photoRead && Capture.CanReadPhotos)
        {
            _photoRead = true;
            await Capture.FromPhotoAsync();
        }
    }

    /// <summary>"Mark as bought" on an idea nobody is tagged in: start from the idea, as bought but not given yet.</summary>
    private void FillFromIdea(Idea idea)
    {
        _loading = true;
        Title = idea.Title;
        Brand = idea.Brand ?? "";
        Store = idea.Store ?? "";
        Category = idea.Category ?? "";
        Amount = idea.Price?.ToString(CultureInfo.CurrentCulture) ?? "";
        Url = idea.Url ?? "";
        Notes = idea.Notes ?? "";
        _loading = false;
        Photo.Url = idea.ImageUrl;
        BoughtNotGiven = true;
        _pendingOccasionId = idea.OccasionId;
        if (idea.People.Count == 1) Subject = Subjects.FirstOrDefault(s => s.PersonId == idea.People[0].Id);
    }

    private void Fill(Gift g)
    {
        IsReceived = g.Direction == GiftDirection.Received;
        _loading = true;
        Title = g.Title;
        Subject = Subjects.FirstOrDefault(s => s.PersonId == g.PersonId && s.FamilyId == g.FamilyId);
        Date = g.Date.ToUniversalTime().Date;
        Amount = g.Amount?.ToString(CultureInfo.CurrentCulture) ?? "";
        Category = g.Category ?? "";
        Brand = g.Brand ?? "";
        Store = g.Store ?? "";
        Url = g.Url ?? "";
        _loading = false;
        Photo.Url = g.PhotoUrl;
        BoughtNotGiven = g.Status == GiftStatus.Bought;
        ValueHidden = g.ValueHidden;
        HasGiftReceipt = g.HasGiftReceipt;
        ThankYouSent = g.ThankYouSent;
        Notes = g.Notes ?? "";
        _pendingOccasionId = g.OccasionId;
    }

    private string? _pendingOccasionId;

    /// <summary>
    /// The occasions to pick from: the chosen person's or family's (group-wide ones included), or every occasion in
    /// the group when nobody is chosen yet. The picked occasion stays selected if it's still in the list.
    /// </summary>
    [RelayCommand]
    public Task LoadOccasionsAsync() => RunAsync(async () =>
    {
        var keep = Occasion?.Id ?? _pendingOccasionId;
        var list = await api.ListOccasionsAsync(_groupId, Subject?.PersonId, Subject?.PersonId is null ? Subject?.FamilyId : null,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-365)), DateOnly.FromDateTime(DateTime.UtcNow.AddDays(365)));
        Occasions = list.Occasions;
        Occasion = Occasions.FirstOrDefault(o => o.Id == keep);
        _pendingOccasionId = null;
    });

    private bool CanSave() => Title.Trim().Length > 0 && Subject is not null;

    public CreateGiftBody? BuildBody()
    {
        decimal? amount = null;
        if (!Validate(() => { amount = ParseMoney(Amount); CheckLink(Url); }) || Subject is null) return null;
        string? Text(string s) => s.Trim() is { Length: > 0 } t ? t : null;
        return new CreateGiftBody
        {
            Direction = IsReceived ? GiftDirection.Received : GiftDirection.Given,
            Title = Title.Trim(),
            Date = DateOnly.FromDateTime(Date).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            PersonId = Subject.PersonId, FamilyId = Subject.FamilyId,
            OccasionId = Occasion?.Id, Amount = amount, Category = Text(Category), Notes = Text(Notes),
            Brand = Text(Brand), Store = IsReceived ? null : Text(Store), Url = Text(Url), PhotoUrl = Photo.Url,
            Status = IsReceived ? null : BoughtNotGiven ? GiftStatus.Bought : GiftStatus.Given,
            ValueHidden = IsReceived ? ValueHidden : null,
            HasGiftReceipt = IsReceived ? HasGiftReceipt : null,
            ThankYouSent = IsReceived ? ThankYouSent : null,
            IdeaId = IsReceived ? null : _ideaId,
        };
    }

    [RelayCommand(CanExecute = nameof(CanSave))]
    public async Task SaveAsync()
    {
        if (BuildBody() is not { } body) return;
        if (GiftId is null)
        {
            await SaveAndCloseAsync(async () =>
            {
                await api.CreateGiftAsync(_groupId, body);
                // Ask for notification permission once the user is actively planning (not at launch).
                try { await session.EnablePushAsync(); } catch (Exception e) when (e is ApiException or HttpRequestException) { }
            });
            return;
        }
        var patch = new Patch().Set("title", body.Title).SetDate("date", DateOnly.ParseExact(body.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture))
            .Set("personId", body.PersonId).Set("familyId", body.FamilyId).Set("occasionId", body.OccasionId)
            .Set("amount", body.Amount).Set("category", body.Category).Set("notes", body.Notes)
            .Set("brand", body.Brand).Set("store", body.Store).Set("url", body.Url).Set("photoUrl", body.PhotoUrl);
        if (IsReceived) patch.Set("valueHidden", ValueHidden).Set("hasGiftReceipt", HasGiftReceipt).Set("thankYouSent", ThankYouSent);
        else patch.SetEnum("status", body.Status!.Value);
        await SaveAndCloseAsync(() => api.UpdateGiftAsync(GiftId, patch));
    }
}

// ---------------- Idea ----------------

public sealed partial class IdeaFormViewModel(BestowdApi api, INavigator nav, DataChanged changes, QuickAdd? quickAdd = null, IPhotoSource? photos = null) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private PhotoSlot? _photo;
    public PhotoSlot Photo => _photo ??= new PhotoSlot(api, photos, () => _groupId);

    private CaptureHelper? _capture;
    public CaptureHelper Capture => _capture ??= new CaptureHelper(api, () => _groupId, new DraftTargets(
        v => Title = v, v => Brand = v, v => Store = v, v => Price = v, v => Url = v, v => Photo.Url = v, () => Url, () => Photo.Url));
    private Suggester? _titleS, _brandS, _storeS, _categoryS;
    public Suggester TitleSuggest => _titleS ??= new Suggester(api, () => _groupId, "title", v => Title = v);
    public Suggester BrandSuggest => _brandS ??= new Suggester(api, () => _groupId, "brand", v => Brand = v);
    public Suggester StoreSuggest => _storeS ??= new Suggester(api, () => _groupId, "store", v => Store = v);
    public Suggester CategorySuggest => _categoryS ??= new Suggester(api, () => _groupId, "category", v => Category = v);
    // Suggest only while the user is typing, not when a saved idea is loaded.
    private bool _loading;
    partial void OnTitleChanged(string value) { if (!_loading) _ = TitleSuggest.UpdateAsync(value); }
    partial void OnBrandChanged(string value) { if (!_loading) _ = BrandSuggest.UpdateAsync(value); }
    partial void OnStoreChanged(string value) { if (!_loading) _ = StoreSuggest.UpdateAsync(value); }
    partial void OnCategoryChanged(string value) { if (!_loading) _ = CategorySuggest.UpdateAsync(value); }

    private string _groupId = "";
    private string? _personId, _occasionId;
    private Idea? _idea;
    private bool _photoRead;

    /// <summary>Set when editing a saved idea.</summary>
    [ObservableProperty, NotifyPropertyChangedFor(nameof(ScreenTitle))] public partial string? IdeaId { get; private set; }
    /// <summary>Opened from a snapped photo: the photo shows first and is read straight away when the group has AI.</summary>
    [ObservableProperty] public partial bool FromPhoto { get; private set; }
    public string ScreenTitle => IdeaId is null ? "Add an idea" : "Edit idea";
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Title { get; set; } = "";
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

    public void Apply(IDictionary<string, object> p)
    {
        _groupId = Params.Get(p, Params.GroupId) ?? "";
        _personId = Params.Get(p, Params.PersonId);
        _occasionId = Params.Get(p, Params.OccasionId);
        IdeaId = Params.Get(p, Params.Id);
        if (Params.Get(p, Params.PhotoUrl) is { } photo) { Photo.Url = photo; FromPhoto = true; }
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        var ai = Capture.LoadAsync();
        await RunAsync(async () =>
        {
            var people = api.ListPeopleAsync(_groupId);
            if (IdeaId is not null && _idea is null) Fill(_idea = await api.GetIdeaAsync(IdeaId));
            var options = SubjectOption.Build(await people, []);
            var tagged = _idea?.People.Select(p => p.Id).ToHashSet() ?? (_personId is null ? [] : [_personId]);
            People.SetOptions(options, options.Where(o => o.PersonId is { } id && tagged.Contains(id)));
        });
        await ai;
        if (FromPhoto && !_photoRead && Capture.CanReadPhotos)
        {
            _photoRead = true;
            await Capture.FromPhotoAsync();
        }
    }

    private void Fill(Idea i)
    {
        _loading = true;
        Title = i.Title;
        Brand = i.Brand ?? "";
        Store = i.Store ?? "";
        Category = i.Category ?? "";
        Price = i.Price?.ToString(CultureInfo.CurrentCulture) ?? "";
        Url = i.Url ?? "";
        AgeMin = i.AgeMin?.ToString(CultureInfo.CurrentCulture) ?? "";
        AgeMax = i.AgeMax?.ToString(CultureInfo.CurrentCulture) ?? "";
        Notes = i.Notes ?? "";
        _loading = false;
        Photo.Url = i.ImageUrl;
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
            Title = Title.Trim(), Brand = Text(Brand), Store = Text(Store), Category = Text(Category), Price = price, Url = Text(Url), Notes = Text(Notes),
            ImageUrl = Photo.Url,
            AgeMin = min, AgeMax = max, OccasionId = _occasionId,
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
