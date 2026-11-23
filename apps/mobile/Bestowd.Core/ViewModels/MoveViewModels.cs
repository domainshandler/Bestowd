using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public static class MoveText
{
    private static string? Count(int n, string one, string many) => n > 0 ? $"{n} {(n == 1 ? one : many)}" : null;

    /// <summary>"2 families, 3 gifts and 1 idea".</summary>
    public static string ListOf(IEnumerable<string?> parts)
    {
        var p = parts.OfType<string>().ToList();
        return p.Count <= 1 ? p.FirstOrDefault() ?? "nothing" : $"{string.Join(", ", p[..^1])} and {p[^1]}";
    }

    public static string Summary(MoveCounts c) => ListOf([
        Count(c.Families, "family", "families"), Count(c.People, "person", "people"), Count(c.Gifts, "gift", "gifts"),
        Count(c.Occasions, "holiday", "holidays"), Count(c.Ideas, "idea", "ideas"),
    ]);

    public static string Contents(int people, int gifts) => ListOf([Count(people, "person", "people"), Count(gifts, "gift", "gifts")]);
}

public enum BringKind { Family, Occasion, Ideas }

/// <summary>A line on the "what to bring" checklist.</summary>
public sealed partial class BringItem(BringKind kind, string id, string label, string hint) : ObservableObject
{
    public BringKind Kind { get; } = kind;
    public string Id { get; } = id;
    public string Label { get; } = label;
    public string Hint { get; } = hint;
    [ObservableProperty] public partial bool IsOn { get; set; } = true;
}

public static class BringChecklist
{
    /// <summary>Everything that could be brought, all ticked.</summary>
    public static IReadOnlyList<BringItem> From(MovableItems m) =>
    [
        .. m.Families.Select(f => new BringItem(BringKind.Family, f.Id, f.IsOwnHousehold ? $"{f.Name} (your household)" : f.Name, MoveText.Contents(f.People, f.Gifts))),
        .. m.Occasions.Select(o => new BringItem(BringKind.Occasion, o.Id, o.Name, "Holiday")),
        .. m.Ideas > 0 ? [new BringItem(BringKind.Ideas, "", "Gift ideas", m.Ideas == 1 ? "1 idea" : $"{m.Ideas} ideas")] : Array.Empty<BringItem>(),
    ];

    public static MoveSelection ToSelection(IEnumerable<BringItem> items)
    {
        var on = items.Where(i => i.IsOn).ToList();
        return new MoveSelection
        {
            FamilyIds = on.Where(i => i.Kind == BringKind.Family).Select(i => i.Id).ToList(),
            OccasionIds = on.Where(i => i.Kind == BringKind.Occasion).Select(i => i.Id).ToList(),
            Ideas = on.Any(i => i.Kind == BringKind.Ideas),
        };
    }
}

/// <summary>A pending request as shown on Home and in Settings.</summary>
public sealed record MoveRequestRow(string Id, string Title, string Line, string Action)
{
    public static MoveRequestRow From(MoveRequestSummary r, bool isOwner) => isOwner
        ? new(r.Id, $"{r.RequestedBy.Name} wants to bring things in", $"{MoveText.Summary(r.Counts)} from {r.FromGroupName}", "Review")
        : new(r.Id, "Waiting for approval", $"{MoveText.Summary(r.Counts)} from {r.FromGroupName}. The group owner reviews it first.", "View");
}

public sealed partial class PersonReviewRow(ReviewPerson p) : ObservableObject
{
    public string Id { get; } = p.Id;
    public string Text { get; } = $"{p.Name} looks like your {p.Match.Name}";
    /// <summary>On: they're the same person, so combine them. Off: keep both.</summary>
    [ObservableProperty] public partial bool Combine { get; set; } = true;
}

public sealed partial class FamilyReviewRow : ObservableObject
{
    public FamilyReviewRow(ReviewFamily f, IEnumerable<ReviewPerson> people)
    {
        Id = f.Id;
        IsHousehold = f.IsOwnHousehold;
        Label = f.IsOwnHousehold ? $"{f.Name}: their household" : f.Name;
        Hint = f.IsOwnHousehold && f.People > 0
            ? MoveText.ListOf([$"{f.People} {(f.People == 1 ? "person joins" : "people join")} your household", f.Gifts > 0 ? $"{f.Gifts} {(f.Gifts == 1 ? "gift" : "gifts")}" : null])
            : MoveText.Contents(f.People, f.Gifts);
        MatchText = f.Match is null ? null : $"Same as your {f.Match.Name}: combine them";
        People = people.Select(p => new PersonReviewRow(p)).ToList();
    }

    public string Id { get; }
    public bool IsHousehold { get; }
    public string Label { get; }
    public string Hint { get; }
    public string? MatchText { get; }
    public IReadOnlyList<PersonReviewRow> People { get; }
    [ObservableProperty, NotifyPropertyChangedFor(nameof(ShowCombine), nameof(ShowPeople))] public partial bool IsOn { get; set; } = true;
    /// <summary>For a look-alike family: on combines it with the match, off keeps both.</summary>
    [ObservableProperty, NotifyPropertyChangedFor(nameof(ShowPeople))] public partial bool Combine { get; set; } = true;
    public bool ShowCombine => IsOn && MatchText is not null;
    public bool ShowPeople => IsOn && People.Count > 0 && (IsHousehold || Combine);
}

public sealed partial class OccasionReviewRow(ReviewOccasion o, Func<decimal?, string> money) : ObservableObject
{
    public string Id { get; } = o.Id;
    public string Name { get; } = o.Name;
    public string Hint { get; } = o.Match is null ? "New to this group" : $"You track {o.Match.Name} too: they become one";
    public bool BudgetDiffers { get; } = o.BudgetDiffers;
    public string BudgetText { get; } = $"Use their budget ({money(o.TheirBudget)}) instead of yours ({money(o.OurBudget)})";
    [ObservableProperty, NotifyPropertyChangedFor(nameof(ShowBudget))] public partial bool IsOn { get; set; } = true;
    [ObservableProperty] public partial bool UseTheirs { get; set; }
    public bool ShowBudget => IsOn && BudgetDiffers;
}

/// <summary>
/// A request to bring things into the group. The owner unticks what they don't want, says whether
/// look-alikes are the same, picks budgets, and approves or declines. The requester can withdraw it.
/// </summary>
public sealed partial class MoveRequestViewModel(BestowdApi api, INavigator nav, DataChanged changes) : ViewModelBase, INavigationTarget, ILoadable
{
    private string _id = "";

    [ObservableProperty] public partial MoveRequestDetail? Request { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<FamilyReviewRow> Families { get; private set; } = [];
    [ObservableProperty] public partial IReadOnlyList<OccasionReviewRow> Occasions { get; private set; } = [];
    [ObservableProperty] public partial bool BringIdeas { get; set; }
    [ObservableProperty] public partial string? CurrencyWarning { get; private set; }

    public string Title => Request is null ? "" : $"{Request.RequestedBy.Name} wants to bring things in";
    public string Summary => Request is null ? "" : $"{MoveText.Summary(Request.Counts)} from {Request.FromGroupName}.";
    public bool CanDecide => Request is { CanDecide: true, Review: not null };
    public bool IsWaiting => Request is { Status: MoveStatus.Pending } && !CanDecide;
    public bool IsDecided => Request is not null && Request.Status != MoveStatus.Pending;
    public string StatusText => Request?.Status switch { MoveStatus.Approved => "Approved", MoveStatus.Declined => "Declined", MoveStatus.Cancelled => "Withdrawn", _ => "" };
    public bool HasIdeas => (Request?.Review?.Ideas ?? 0) > 0;
    public bool HasFamilies => Families.Count > 0;
    public bool HasOccasions => Occasions.Count > 0;
    public string IdeasHint => Request?.Review?.Ideas is int n and > 0 ? (n == 1 ? "1 idea" : $"{n} ideas") : "";
    public string DeclineNote => Request is null ? "" : $"Declining leaves everything in {Request.FromGroupName}. {Request.RequestedBy.Name} can ask again later.";
    public string Intro
    {
        get
        {
            var r = Request?.Review;
            if (r is null) return "";
            var n = r.Families.Count(f => f.Match is not null) + r.People.Count + r.Occasions.Count(o => o.Match is not null);
            var looks = n == 0 ? "Nothing looks like something you already have." : $"{(n == 1 ? "One item looks" : $"{n} items look")} like something you already have: say whether they're the same.";
            return $"Untick anything you don't want. {looks} Your group's settings don't change.";
        }
    }

    public void Apply(IDictionary<string, object> p) => _id = Params.Get(p, Params.Id) ?? "";

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        var detail = await api.GetMoveRequestAsync(_id);
        var currency = detail.CanDecide ? (await api.GetGroupAsync(detail.GroupId)).Currency : "CAD";
        SetData(detail, currency);
    });

    public void SetData(MoveRequestDetail detail, string currency)
    {
        Request = detail;
        var review = detail.Review;
        string Money(decimal? d) => d is null ? "none" : Format.Money(d.Value, currency);
        Families = review?.Families.Select(f => new FamilyReviewRow(f, review.People.Where(p => p.FamilyId == f.Id))).ToList() ?? [];
        Occasions = review?.Occasions.Select(o => new OccasionReviewRow(o, Money)).ToList() ?? [];
        BringIdeas = HasIdeas;
        CurrencyWarning = review?.Currency is { } c
            ? $"{detail.FromGroupName} uses {c.From} and this group uses {c.To}. Amounts aren't converted: they'll show in {c.To}."
            : null;
        HasLoaded = true;
        foreach (var name in new[] { nameof(Title), nameof(Summary), nameof(CanDecide), nameof(IsWaiting), nameof(IsDecided), nameof(StatusText), nameof(HasIdeas), nameof(HasFamilies), nameof(HasOccasions), nameof(IdeasHint), nameof(DeclineNote), nameof(Intro) })
            OnPropertyChanged(name);
    }

    public ApproveMoveBody BuildApproval() => new()
    {
        FamilyIds = Families.Where(f => f.IsOn).Select(f => f.Id).ToList(),
        OccasionIds = Occasions.Where(o => o.IsOn).Select(o => o.Id).ToList(),
        Ideas = HasIdeas && BringIdeas,
        KeepBothFamilies = Families.Where(f => f.IsOn && f.MatchText is not null && !f.Combine).Select(f => f.Id).ToList(),
        KeepBothPeople = Families.Where(f => f.ShowPeople).SelectMany(f => f.People).Where(p => !p.Combine).Select(p => p.Id).ToList(),
        UseTheirBudget = Occasions.Where(o => o.ShowBudget && o.UseTheirs).Select(o => o.Id).ToList(),
    };

    private async Task FinishAsync(Func<Task> act)
    {
        if (!await RunAsync(act)) return;
        changes.Notify();
        await nav.GoToAsync(Routes.Home);
    }

    [RelayCommand]
    public Task ApproveAsync()
    {
        var body = BuildApproval();
        if (body.FamilyIds.Count == 0 && body.OccasionIds.Count == 0 && !body.Ideas) { Error = "Tick something to bring, or decline."; return Task.CompletedTask; }
        return FinishAsync(() => api.ApproveMoveAsync(_id, body));
    }

    [RelayCommand] public Task DeclineAsync() => FinishAsync(() => api.DeclineMoveAsync(_id));
    [RelayCommand] public Task WithdrawAsync() => FinishAsync(() => api.CancelMoveAsync(_id));
}

/// <summary>Settings → "Bring my things": ask to bring what's still in your own group into this one.</summary>
public sealed partial class BringViewModel(BestowdApi api, GroupState groups, INavigator nav, DataChanged changes) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private string _groupId = "";

    [ObservableProperty] public partial IReadOnlyList<BringItem> Items { get; private set; } = [];
    [ObservableProperty] public partial string Intro { get; private set; } = "";

    public void Apply(IDictionary<string, object> p) => _groupId = Params.Get(p, Params.GroupId) ?? groups.GroupId ?? "";

    [RelayCommand]
    public Task LoadAsync() => RunAsync(async () =>
    {
        var res = await api.GetGroupMovableAsync(_groupId);
        Items = res.Movable is { } m ? BringChecklist.From(m) : [];
        Intro = res.Movable is { } g
            ? $"From {g.GroupName}. Gifts go with the family or person they're for; anything unticked stays in {g.GroupName}. The group's owner reviews it before anything moves."
            : "There's nothing left to bring.";
        HasLoaded = true;
    });

    [RelayCommand]
    public Task SendAsync()
    {
        var selection = BringChecklist.ToSelection(Items);
        if (selection.IsEmpty) { Error = "Tick something to bring."; return Task.CompletedTask; }
        return SaveAndCloseAsync(() => api.RequestMoveAsync(_groupId, selection));
    }
}
