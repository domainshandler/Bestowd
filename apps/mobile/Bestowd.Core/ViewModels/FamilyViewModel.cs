using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public sealed record MemberRow(ProfilePerson Person, string Initials, string Line, string? SoonBadge);

public sealed record SharedRow(string Name, string Details);

/// <summary>Per-person gifting notes (loves, avoid, sizes, food note).</summary>
public sealed record Fact(string Label, string Value);

public sealed record NotesView(string PersonId, string Name, IReadOnlyList<string> Loves, IReadOnlyList<string> Avoid, IReadOnlyList<Fact> Facts, string? Notes)
{
    public bool IsEmpty => Loves.Count == 0 && Avoid.Count == 0 && Facts.Count == 0 && string.IsNullOrEmpty(Notes);

    public static NotesView From(Person p) => new(
        p.Id, p.Name, p.Likes, p.Avoid,
        p.Sizes.Select(kv => new Fact($"{kv.Key} size", kv.Value)).Concat(p.FoodNotes is { Length: > 0 } f ? [new Fact("Food note", f)] : []).ToList(),
        p.Notes);
}

/// <summary>A family's profile: members, upcoming occasions, notes, what a connected family shares, history and settings.</summary>
public sealed partial class FamilyViewModel(BestowdApi api, INavigator nav, IPrompts prompts, DataChanged changes) : ViewModelBase, INavigationTarget, ILoadable
{
    [ObservableProperty] public partial string FamilyId { get; private set; } = "";
    [ObservableProperty] public partial FamilyProfile? Profile { get; private set; }
    [ObservableProperty] public partial string Currency { get; private set; } = "CAD";
    [ObservableProperty] public partial string? CoGivers { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<MemberRow> Members { get; private set; } = [];
    [ObservableProperty] public partial OccasionItem? Featured { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<OccasionItem> Upcoming { get; private set; } = [];
    [ObservableProperty] public partial IReadOnlyList<NotesView> Notes { get; private set; } = [];
    [ObservableProperty] public partial NotesView? SelectedNotes { get; set; }
    [ObservableProperty] public partial IReadOnlyList<SharedRow> Shared { get; private set; } = [];
    [ObservableProperty] public partial IReadOnlyList<GiftItem> History { get; private set; } = [];
    [ObservableProperty] public partial int HistoryCount { get; private set; }

    public string StatusText => Profile?.Status switch { FamilyStatus.Paused => "Paused", FamilyStatus.Archived => "Archived", _ => "Active" };
    public string KindText => Profile is null ? "" : Profile.IsOwnHousehold ? "Your household" : Format.Label(Profile.Type);
    public string SpentText => Format.Money(Profile?.Totals.Spent ?? 0, Currency);
    public bool CanInvite => Profile is { IsOwnHousehold: false, Connection: null };
    public bool IsConnected => Profile?.Connection is not null;
    public bool CanArchive => Profile is { IsOwnHousehold: false };
    public string PauseText => Profile?.Status == FamilyStatus.Paused ? "Resume this family" : "Pause this family";
    public string ArchiveText => Profile?.Status == FamilyStatus.Archived ? "Restore family" : "Archive family";

    public void Apply(IDictionary<string, object> parameters) => FamilyId = Params.Get(parameters, Params.Id) ?? "";

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        var profile = await api.GetFamilyAsync(FamilyId);
        var group = api.GetGroupAsync(profile.GroupId);
        var gifts = api.ListGiftsAsync(profile.GroupId, familyId: FamilyId);
        SetData(profile, await group, await gifts);
    });

    public void SetData(FamilyProfile profile, Group group, GiftList gifts, DateTime? now = null)
    {
        Profile = profile;
        Currency = group.Currency;
        CoGivers = group.Members.Count == 0 ? null : "Co-givers: " + string.Join(" & ", group.Members.Select(m => m.Name.Split(' ')[0]));
        Members = profile.People.Select(p => new MemberRow(p, Format.Initials(p.Name), MemberLine(p),
            p.NextBirthday is { } b && Format.DaysUntil(b, now) <= 30 ? Format.InDays(b, now) : null)).ToList();

        var occasions = profile.Occasions.Select(o => OccasionItem.From(o)).ToList();
        Featured = occasions.FirstOrDefault(o => o.Occasion is { NeedsGift: true, PersonId: not null, NextOccurrence: { } n } && Format.DaysUntil(n, now) <= 30);
        Upcoming = occasions.Where(o => o != Featured).ToList();

        Notes = profile.People.Select(NotesView.From).ToList();
        SelectedNotes = Notes.FirstOrDefault(n => n.PersonId == SelectedNotes?.PersonId) ?? Notes.FirstOrDefault();

        Shared = profile.Connection?.People.Select(p => new SharedRow(p.Name, SharedDetails(p))).ToList() ?? [];
        History = gifts.Gifts.Take(5).Select(g => GiftItem.From(g, Currency)).ToList();
        HistoryCount = gifts.Gifts.Count;
        HasLoaded = true;
        foreach (var name in new[] { nameof(StatusText), nameof(KindText), nameof(SpentText), nameof(CanInvite), nameof(IsConnected), nameof(CanArchive), nameof(PauseText), nameof(ArchiveText) })
            OnPropertyChanged(name);
    }

    /// <summary>"Turns 5 · Nov 22", else relationship and birthday.</summary>
    public static string MemberLine(ProfilePerson p)
    {
        var bday = Format.Birthday(p.BirthMonth, p.BirthDay);
        if (p.NextBirthday is { } next && p.BirthYear is { } year) return $"Turns {next.ToUniversalTime().Year - year} · {bday}";
        var parts = new[] { p.Relationship, bday }.Where(s => !string.IsNullOrEmpty(s)).ToList();
        return parts.Count == 0 ? "No birthday yet" : string.Join(" · ", parts);
    }

    public static string SharedDetails(SharedPerson p)
    {
        var parts = new List<string>();
        if (p.BirthMonth is not null) parts.Add($"Birthday {Format.Birthday(p.BirthMonth, p.BirthDay)}{(p.BirthYear is { } y ? $" {y}" : "")}");
        if (p.Likes is { Count: > 0 }) parts.Add("Loves " + string.Join(", ", p.Likes));
        if (p.Avoid is { Count: > 0 }) parts.Add("Avoid " + string.Join(", ", p.Avoid));
        if (p.FoodNotes is { Length: > 0 }) parts.Add("Food: " + p.FoodNotes);
        if (p.Sizes is { Count: > 0 }) parts.Add(string.Join(", ", p.Sizes.Select(kv => $"{kv.Key} {kv.Value}")));
        return parts.Count == 0 ? "Nothing shared yet" : string.Join(" · ", parts);
    }

    private Dictionary<string, object> GroupParams(params (string, object)[] extra)
    {
        var d = new Dictionary<string, object> { [Params.GroupId] = Profile!.GroupId };
        foreach (var (k, v) in extra) d[k] = v;
        return d;
    }

    [RelayCommand] public void SelectNotes(NotesView notes) => SelectedNotes = notes;

    [RelayCommand] public Task OpenPersonAsync(MemberRow row) => nav.GoToAsync(Routes.Person, new Dictionary<string, object> { [Params.Id] = row.Person.Id });
    [RelayCommand] public Task OpenOccasionAsync(OccasionItem item) { var (r, id) = item.Target; return nav.GoToAsync(r, new Dictionary<string, object> { [Params.Id] = id }); }
    [RelayCommand] public Task EditAsync() => Profile is null ? Task.CompletedTask : nav.GoToAsync(Routes.FamilyForm, GroupParams((Params.Id, FamilyId)));
    [RelayCommand] public Task AddPersonAsync() => nav.GoToAsync(Routes.PersonForm, new Dictionary<string, object> { [Params.FamilyId] = FamilyId });
    [RelayCommand] public Task AddOccasionAsync() => Profile is null ? Task.CompletedTask : nav.GoToAsync(Routes.OccasionForm, GroupParams((Params.FamilyId, FamilyId)));
    [RelayCommand] public Task LogGiftAsync() => Profile is null ? Task.CompletedTask : nav.GoToAsync(Routes.LogGift, GroupParams((Params.FamilyId, FamilyId)));
    [RelayCommand] public Task EditNotesAsync() => SelectedNotes is null ? Task.CompletedTask : nav.GoToAsync(Routes.PersonForm, new Dictionary<string, object> { [Params.Id] = SelectedNotes.PersonId, [Params.FamilyId] = FamilyId });

    [RelayCommand]
    public Task SeeIdeasAsync() => Featured is null ? Task.CompletedTask : nav.GoToAsync(Routes.Ideas,
        new Dictionary<string, object> { [Params.PersonId] = Featured.Occasion.PersonId!, [Params.OccasionId] = Featured.Occasion.Id });

    [RelayCommand]
    public Task TogglePauseAsync() => Save(new Patch().SetEnum("status", Profile?.Status == FamilyStatus.Paused ? FamilyStatus.Active : FamilyStatus.Paused));

    [RelayCommand]
    public Task ToggleArchiveAsync() => Save(new Patch().SetEnum("status", Profile?.Status == FamilyStatus.Archived ? FamilyStatus.Active : FamilyStatus.Archived));

    private async Task Save(Patch patch)
    {
        if (await RunAsync(() => api.UpdateFamilyAsync(FamilyId, patch))) { changes.Notify(); await LoadAsync(); }
    }

    [RelayCommand]
    public async Task DeleteAsync()
    {
        if (Profile is null || !await prompts.ConfirmAsync($"Delete {Profile.Name}?", "This removes its people, occasions and gift history. It can't be undone.", "Delete")) return;
        if (await RunAsync(() => api.DeleteFamilyAsync(FamilyId))) { changes.Notify(); await nav.GoBackAsync(); }
    }

    [RelayCommand]
    public async Task InviteAsync()
    {
        if (Profile is null) return;
        InviteLink? link = null;
        if (!await RunAsync(async () => link = await api.CreateInviteAsync(Profile.GroupId, InviteKind.Family, FamilyId))) return;
        await prompts.ShareAsync($"Connect {Profile.Name}", $"Connect {Profile.Name} on Bestowd so we can keep gifts in step: {link!.Url}");
    }

    [RelayCommand]
    public async Task DisconnectAsync()
    {
        if (Profile?.Connection is not { } c) return;
        if (!await prompts.ConfirmAsync($"Disconnect {c.SourceFamilyName}?", "You'll stop seeing what they share.", "Disconnect")) return;
        if (await RunAsync(() => api.RevokeConnectionAsync(c.Id))) { changes.Notify(); await LoadAsync(); }
    }
}
