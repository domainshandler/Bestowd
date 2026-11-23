using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public sealed record IdeaCard(Idea Idea, bool IsTopPick, string? PriceText, string? RepeatText, string Meta, bool CanBuy);

public sealed record PersonChoice(string? Id, string Label);

/// <summary>Ideas: saved ideas for a person (matched by tag or age on the occasion date), with repeat warnings.</summary>
public sealed partial class IdeasViewModel(BestowdApi api, GroupState groups, INavigator nav, DataChanged changes) : ViewModelBase, INavigationTarget, ILoadable
{
    private string? _requestedOccasionId;
    private string? _familyId;
    private RecipientPicker? _filter;

    /// <summary>"Ideas for": type a person's or family's name to narrow the board. Empty = everyone.</summary>
    public RecipientPicker Filter
    {
        get
        {
            if (_filter is not null) return _filter;
            _filter = new RecipientPicker(includeFamilies: true, single: true);
            _filter.Changed += (_, _) =>
            {
                var chosen = _filter.Chosen.FirstOrDefault();
                var familyChanged = _familyId != chosen?.FamilyId;
                _familyId = chosen?.FamilyId;
                var before = Selected?.Id;
                Selected = chosen?.PersonId is { } id ? new PersonChoice(id, $"For {chosen.DisplayName}") : People[0];
                if (before == Selected?.Id && familyChanged && HasLoaded) LoadCommand.Execute(null);
            };
            return _filter;
        }
    }

    [ObservableProperty] public partial IReadOnlyList<PersonChoice> People { get; private set; } = [new(null, "Everyone")];
    [ObservableProperty] public partial PersonChoice? Selected { get; set; }
    [ObservableProperty] public partial Occasion? Occasion { get; private set; }
    [ObservableProperty] public partial string? Header { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<IdeaCard> Ideas { get; private set; } = [];
    [ObservableProperty] public partial string? RepeatNotice { get; private set; }

    public bool IsEmpty => HasLoaded && Ideas.Count == 0 && Error is null;
    public string EmptyText => Selected?.Id is not null ? $"No saved ideas fit {Selected.Label.Replace("For ", "")} yet."
        : _familyId is not null ? "No saved ideas for anyone in this family yet." : "No saved ideas yet.";

    public void Apply(IDictionary<string, object> parameters)
    {
        var personId = Params.Get(parameters, Params.PersonId);
        _requestedOccasionId = Params.Get(parameters, Params.OccasionId);
        Selected = People.FirstOrDefault(p => p.Id == personId) ?? (personId is null ? null : new PersonChoice(personId, ""));
    }

    partial void OnSelectedChanged(PersonChoice? oldValue, PersonChoice? newValue)
    {
        if (oldValue?.Id != newValue?.Id && HasLoaded) LoadCommand.Execute(null);
    }

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        if (groups.GroupId is not { } groupId) return;
        var peopleTask = api.ListPeopleAsync(groupId);
        var families = await api.ListFamiliesAsync(groupId);
        var people = await peopleTask;
        People = [new PersonChoice(null, "Everyone"), .. people.Select(p => new PersonChoice(p.Id, $"For {p.Name}"))];
        var personId = Selected?.Id;
        var options = SubjectOption.Build(people, families);
        Filter.SetOptions(options, options.Where(o => personId is not null ? o.PersonId == personId : _familyId is not null && o.FamilyId == _familyId));
        // Keep the selection pointing at the item in the new list (the picker matches by reference).
        Selected = People.FirstOrDefault(p => p.Id == personId) ?? People[0];

        GroupOccasions? occasions = personId is null ? null
            : await api.ListOccasionsAsync(groupId, personId: personId, to: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(366)));
        var occasion = occasions?.Occasions.FirstOrDefault(o => o.Id == _requestedOccasionId) ?? occasions?.Occasions.FirstOrDefault();
        var ideas = await api.ListIdeasAsync(groupId, personId, occasion?.Id, personId is null ? _familyId : null);
        SetData(ideas, occasion, occasions?.Currency ?? "CAD", people.FirstOrDefault(p => p.Id == personId)?.FamilyName);
    });

    public void SetData(IdeaList list, Occasion? occasion, string currency, string? familyName = null)
    {
        Occasion = occasion;
        var personId = list.Person?.Id;
        var topPick = personId is null ? null : list.Ideas.FirstOrDefault(i => i.Repeat is null);
        Ideas = list.Ideas.Select(i => new IdeaCard(
            i,
            IsTopPick: i == topPick,
            PriceText: i.Price is null ? null : Format.Money(i.Price, currency),
            RepeatText: i.Repeat is { } r ? $"You gave “{r.Title}” in {Format.MonthYear(r.Date)}." : null,
            Meta: string.Join(" · ", new[]
            {
                i.People.Count > 0 ? "For " + string.Join(", ", i.People.Select(p => p.Name)) : null,
                i.AgeMin is not null || i.AgeMax is not null ? $"Ages {i.AgeMin ?? 0}–{(i.AgeMax is { } max ? max.ToString(System.Globalization.CultureInfo.CurrentCulture) : "∞")}" : null,
            }.Where(s => s is not null)),
            CanBuy: personId is not null || i.People.Count == 1 || i.OccasionId is not null)).ToList();

        var repeats = list.Ideas.Where(i => i.Repeat is not null).ToList();
        RepeatNotice = repeats.Count == 0 ? null
            : string.Join(" · ", repeats.Select(i => $"{i.Category ?? i.Title}: you gave one in {Format.MonthYear(i.Repeat!.Date)}"));

        Header = list.Person is not { } p ? null : string.Join(" · ", new[]
        {
            p.Age is { } age ? $"{(occasion?.Type == OccasionType.Birthday ? "Turning" : "Age")} {age}" : null,
            occasion?.NextOccurrence is { } next ? $"{occasion.Name} · {Format.ShortDate(next)}" : null,
            occasion?.EffectiveBudget is { } budget ? $"Budget {Format.Money(budget, occasion.Currency)}" : null,
        }.Where(s => s is not null)) is { Length: > 0 } h ? h : familyName;
        HasLoaded = true;
        OnPropertyChanged(nameof(IsEmpty));
        OnPropertyChanged(nameof(EmptyText));
    }

    /// <summary>The buy request: the chosen person (with the occasion), else the idea's only tagged person.</summary>
    public BuyIdeaBody BuyBodyFor(Idea idea)
    {
        var personId = Selected?.Id ?? (idea.People.Count == 1 ? idea.People[0].Id : null);
        return new BuyIdeaBody { PersonId = personId, OccasionId = Selected?.Id is not null ? Occasion?.Id : null };
    }

    [RelayCommand]
    public async Task BuyAsync(IdeaCard card)
    {
        if (await RunAsync(() => api.BuyIdeaAsync(card.Idea.Id, BuyBodyFor(card.Idea)))) { changes.Notify(); await LoadAsync(); }
    }

    [RelayCommand]
    public async Task DismissAsync(IdeaCard card)
    {
        if (await RunAsync(() => api.UpdateIdeaAsync(card.Idea.Id, new Patch().SetEnum("status", IdeaStatus.Dismissed)))) { changes.Notify(); await LoadAsync(); }
    }

    [RelayCommand]
    public Task AddIdeaAsync()
    {
        if (groups.GroupId is not { } g) return Task.CompletedTask;
        var p = new Dictionary<string, object> { [Params.GroupId] = g };
        if (Selected?.Id is { } personId) p[Params.PersonId] = personId;
        if (Selected?.Id is not null && Occasion is not null) p[Params.OccasionId] = Occasion.Id;
        return nav.GoToAsync(Routes.IdeaForm, p);
    }
}
