using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Auth;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>Log a given or received gift, or edit one.</summary>
public sealed partial class LogGiftViewModel(BestowdApi api, GroupState groups, Session session, INavigator nav, DataChanged changes, QuickAdd? quickAdd = null, IPhotoSource? photos = null) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private RecipientPicker? _who;
    private ProductDetails? _product;

    /// <summary>The item's photo, filling in from a link or photo, and autofill on its text fields.</summary>
    public ProductDetails Product => _product ??= new ProductDetails(api, photos, () => _groupId, new ProductFields(
        v => Title = v, v => Brand = v, v => Store = v, v => Category = v, v => Amount = v, v => Url = v, () => Url));
    partial void OnTitleChanged(string value) => Product.Typed(Product.TitleSuggest, value);
    partial void OnBrandChanged(string value) => Product.Typed(Product.BrandSuggest, value);
    partial void OnStoreChanged(string value) => Product.Typed(Product.StoreSuggest, value);
    partial void OnCategoryChanged(string value) => Product.Typed(Product.CategorySuggest, value);



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
    private bool _ideaFilled;

    [ObservableProperty] public partial string? GiftId { get; private set; }
    [ObservableProperty] public partial bool IsReceived { get; set; }
    [ObservableProperty][NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Title { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyList<SubjectOption> Subjects { get; private set; } = [];
    [ObservableProperty][NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial SubjectOption? Subject { get; set; }
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

    public void Apply(IDictionary<string, object> parameters)
    {
        _groupId = Params.Get(parameters, Params.GroupId) ?? groups.GroupId ?? "";
        GiftId = Params.Get(parameters, Params.Id);
        _defaultPersonId = Params.Get(parameters, Params.PersonId);
        _defaultFamilyId = Params.Get(parameters, Params.FamilyId);
        _pendingOccasionId = Params.Get(parameters, Params.OccasionId);
        IsReceived = Params.Get(parameters, Params.Direction) == "RECEIVED";
        _ideaId = Params.Get(parameters, Params.IdeaId);
        if (Params.Get(parameters, Params.PhotoUrl) is { } photo) Product.StartFromPhoto(photo);
        OnPropertyChanged(nameof(ScreenTitle));
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        var ai = Product.LoadAsync();
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
        await Product.ReadSnappedPhotoAsync(ai);
    }

    /// <summary>"Mark as bought" on an idea nobody is tagged in: start from the idea, as bought but not given yet.</summary>
    private void FillFromIdea(Idea idea)
    {
        Product.FillQuietly(() =>
        {
            Title = idea.Title;
            Brand = idea.Brand ?? "";
            Store = idea.Store ?? "";
            Category = idea.Category ?? "";
            Amount = idea.Price?.ToString(CultureInfo.CurrentCulture) ?? "";
            Url = idea.Url ?? "";
            Notes = idea.Notes ?? "";
        });
        Product.Photo.Url = idea.ImageUrl;
        BoughtNotGiven = true;
        _pendingOccasionId = idea.OccasionId;
        if (idea.People.Count == 1) Subject = Subjects.FirstOrDefault(s => s.PersonId == idea.People[0].Id);
    }

    private void Fill(Gift g)
    {
        IsReceived = g.Direction == GiftDirection.Received;
        Product.FillQuietly(() =>
        {
            Title = g.Title;
            Subject = Subjects.FirstOrDefault(s => s.PersonId == g.PersonId && s.FamilyId == g.FamilyId);
            Date = g.Date.ToUniversalTime().Date;
            Amount = g.Amount?.ToString(CultureInfo.CurrentCulture) ?? "";
            Category = g.Category ?? "";
            Brand = g.Brand ?? "";
            Store = g.Store ?? "";
            Url = g.Url ?? "";
        });
        Product.Photo.Url = g.PhotoUrl;
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
            PersonId = Subject.PersonId,
            FamilyId = Subject.FamilyId,
            OccasionId = Occasion?.Id,
            Amount = amount,
            Category = Text(Category),
            Notes = Text(Notes),
            Brand = Text(Brand),
            Store = IsReceived ? null : Text(Store),
            Url = Text(Url),
            PhotoUrl = Product.Photo.Url,
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
