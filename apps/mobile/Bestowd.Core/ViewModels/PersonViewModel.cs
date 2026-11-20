using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public sealed record IdeaRow(Idea Idea, string? PriceText);

/// <summary>A person: notes, occasions, given/received history by year, and ideas with repeat warnings.</summary>
public sealed partial class PersonViewModel(BestowdApi api, INavigator nav, IPrompts prompts, DataChanged changes) : ViewModelBase, INavigationTarget, ILoadable
{
    private GiftList? _gifts;

    [ObservableProperty] public partial string PersonId { get; private set; } = "";
    [ObservableProperty] public partial PersonDetail? Person { get; private set; }
    [ObservableProperty] public partial NotesView? Notes { get; private set; }
    [ObservableProperty] public partial string Summary { get; private set; } = "";
    [ObservableProperty] public partial IReadOnlyList<OccasionItem> Occasions { get; private set; } = [];
    [ObservableProperty] public partial bool ShowReceived { get; set; }
    [ObservableProperty] public partial IReadOnlyList<GiftSection> History { get; private set; } = [];
    [ObservableProperty] public partial IReadOnlyList<IdeaRow> Ideas { get; private set; } = [];
    [ObservableProperty] public partial string? RepeatNotice { get; private set; }

    public string Initials => Format.Initials(Person?.Name ?? "?");
    public string ArchiveText => Person?.ArchivedAt is null ? $"Archive {Person?.Name}" : $"Restore {Person?.Name}";
    public string HistoryEmptyText => ShowReceived ? $"Nothing received from {Person?.Name} yet." : $"Nothing given to {Person?.Name} yet.";

    partial void OnShowReceivedChanged(bool value) { RebuildHistory(); OnPropertyChanged(nameof(HistoryEmptyText)); }

    public void Apply(IDictionary<string, object> parameters) => PersonId = Params.Get(parameters, Params.Id) ?? "";

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        var person = await api.GetPersonAsync(PersonId);
        var gifts = api.ListGiftsAsync(person.GroupId, personId: PersonId);
        var ideas = api.ListIdeasAsync(person.GroupId, personId: PersonId);
        var occasions = api.ListOccasionsAsync(person.GroupId, personId: PersonId, to: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(365)));
        SetData(person, await gifts, await ideas, await occasions);
    });

    public void SetData(PersonDetail person, GiftList gifts, IdeaList ideas, GroupOccasions occasions)
    {
        Person = person;
        Notes = NotesView.From(person);
        var bday = Format.Birthday(person.BirthMonth, person.BirthDay);
        Summary = string.Join(" · ", new[] { person.Age is { } a ? $"{a} years old" : null, bday.Length > 0 ? $"Birthday {bday}" : null, person.Relationship }
            .Where(s => !string.IsNullOrEmpty(s)));
        Occasions = occasions.Occasions.Select(o => OccasionItem.From(o)).ToList();
        _gifts = gifts;
        RebuildHistory();
        Ideas = ideas.Ideas.Take(3).Select(i => new IdeaRow(i, i.Price is null ? null : Format.Money(i.Price, gifts.Currency))).ToList();
        var repeats = ideas.Ideas.Where(i => i.Repeat is not null).ToList();
        RepeatNotice = repeats.Count switch
        {
            0 => null,
            1 => $"“{repeats[0].Title}” repeats something you've given before.",
            var n => $"{n} ideas repeat something you've given before.",
        };
        HasLoaded = true;
        foreach (var name in new[] { nameof(Initials), nameof(ArchiveText), nameof(HistoryEmptyText) }) OnPropertyChanged(name);
    }

    private void RebuildHistory()
    {
        if (_gifts is null) return;
        var direction = ShowReceived ? GiftDirection.Received : GiftDirection.Given;
        History = GiftGrouping.ByYear(_gifts.Gifts.Where(g => g.Direction == direction), _gifts.Currency);
    }

    private Dictionary<string, object> P(params (string, object)[] values) => values.ToDictionary(v => v.Item1, v => v.Item2);

    [RelayCommand] public Task EditAsync() => Person is null ? Task.CompletedTask : nav.GoToAsync(Routes.PersonForm, P((Params.Id, PersonId), (Params.FamilyId, Person.FamilyId)));
    [RelayCommand] public Task LogGiftAsync() => Person is null ? Task.CompletedTask : nav.GoToAsync(Routes.LogGift, P((Params.GroupId, Person.GroupId), (Params.PersonId, PersonId)));
    [RelayCommand] public Task AddOccasionAsync() => Person is null ? Task.CompletedTask : nav.GoToAsync(Routes.OccasionForm, P((Params.GroupId, Person.GroupId), (Params.PersonId, PersonId), (Params.SubjectName, Person.Name)));
    [RelayCommand] public Task SeeIdeasAsync() => nav.GoToAsync(Routes.Ideas, P((Params.PersonId, PersonId)));
    [RelayCommand] public Task OpenFamilyAsync() => Person is null ? Task.CompletedTask : nav.GoToAsync(Routes.Family, P((Params.Id, Person.FamilyId)));

    [RelayCommand]
    public async Task ToggleArchiveAsync()
    {
        if (Person is null) return;
        if (await RunAsync(() => api.UpdatePersonAsync(PersonId, new Patch().Set("archived", Person.ArchivedAt is null)))) { changes.Notify(); await LoadAsync(); }
    }

    [RelayCommand]
    public async Task DeleteAsync()
    {
        if (Person is null || !await prompts.ConfirmAsync($"Delete {Person.Name}?", "This also removes their gift history.", "Delete")) return;
        if (await RunAsync(() => api.DeletePersonAsync(PersonId))) { changes.Notify(); await nav.GoBackAsync(); }
    }
}
