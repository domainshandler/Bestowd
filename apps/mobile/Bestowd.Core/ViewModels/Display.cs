using Bestowd.Core.Formatting;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

/// <summary>Badge colours, mapped to brushes by the app.</summary>
public enum Tone { Brand, Amber, Neutral, Danger }

/// <summary>Screens that receive navigation parameters.</summary>
public interface INavigationTarget
{
    void Apply(IDictionary<string, object> parameters);
}

public static class Params
{
    public const string Id = "id";
    public const string GroupId = "groupId";
    public const string PersonId = "personId";
    public const string FamilyId = "familyId";
    public const string OccasionId = "occasionId";
    public const string Direction = "direction";
    public const string Token = "token";
    public const string SubjectName = "subjectName";

    public static string? Get(IDictionary<string, object> p, string key) =>
        p.TryGetValue(key, out var v) ? v?.ToString() is { Length: > 0 } s ? Uri.UnescapeDataString(s) : null : null;
}

public sealed record OccasionItem(
    Occasion Occasion,
    string Month,
    int Day,
    string Title,
    string Subtitle,
    string StatusText,
    Tone StatusTone)
{
    public static OccasionItem From(Occasion o, bool showGroup = false)
    {
        var parts = new List<string>();
        // A group-wide occasion for the whole group shows how many families are covered; on a family's pages it's that family's share.
        if (o.Coverage is { } c && o.SubjectFamilyId is null) parts.Add($"{c.CoveredCount} of {o.SubjectName} have a gift");
        else if (o.PersonId is not null && o.SubjectFamilyName is not null) parts.Add(o.SubjectFamilyName);
        else parts.Add(o.SubjectName);
        if (showGroup) parts.Add(o.GroupName);
        if (o.EffectiveBudget is not null)
            parts.Add(o.Spent > 0 ? $"{Format.Money(o.Spent, o.Currency)} of {Format.Money(o.EffectiveBudget, o.Currency)}" : $"Budget {Format.Money(o.EffectiveBudget, o.Currency)}");
        var when = o.NextOccurrence ?? o.Date;
        return new OccasionItem(o, Format.MonthShort(when), Format.Day(when), o.Name, string.Join(" · ", parts), Format.Label(o.Status), ToneFor(o.Status));
    }

    public static Tone ToneFor(OccasionStatus s) => s switch
    {
        OccasionStatus.NotStarted => Tone.Amber,
        OccasionStatus.IdeaSaved => Tone.Neutral,
        _ => Tone.Brand,
    };

    /// <summary>Where tapping goes: a group-wide occasion's own screen, else the person, else the family.</summary>
    public (string Route, string Id) Target =>
        Occasion.IsGroupWide ? (Routes.GroupOccasion, Occasion.Id)
        : Occasion.PersonId is { } p ? (Routes.Person, p)
        : (Routes.Family, Occasion.FamilyId ?? Occasion.SubjectFamilyId ?? "");
}

public sealed record GiftItem(Gift Gift, string Title, string Line, string? AmountText, bool ShowReveal, string? BadgeText, Tone BadgeTone)
{
    public bool IsReceived => Gift.Direction == GiftDirection.Received;
    public string Arrow => IsReceived ? "↙" : "↗";
    public string DirectionText => IsReceived ? "Received" : "Given";
    public bool HasAmount => AmountText is not null;
    public bool CanMarkThanked => IsReceived && !Gift.ThankYouSent;

    public static GiftItem From(Gift g, string currency, bool showYear = true)
    {
        var received = g.Direction == GiftDirection.Received;
        var when = g.OccasionName is not null
            ? g.OccasionName + (showYear && g.OccasionDate is { } od ? $" {od.ToUniversalTime().Year}" : "")
            : showYear ? Format.MonthYear(g.Date) : Format.ShortDate(g.Date);
        var parts = new List<string> { $"{(received ? "From" : "To")} {g.CounterpartyName}", when };
        if (g.Reaction is { } r) parts.Add(Format.Label(r));

        string? amount = null;
        var reveal = false;
        if (g.Amount is not null)
        {
            if (received && g.ValueHidden) reveal = true;
            else amount = Format.Money(g.Amount, currency);
        }

        (string? badge, Tone tone) = received
            ? (g.ThankYouSent ? ("Thanked", Tone.Brand) : ("Thank-you due", Tone.Amber))
            : g.Status == GiftStatus.Bought ? ("Bought", Tone.Neutral) : (null, Tone.Neutral);

        return new GiftItem(g, g.Title, string.Join(" · ", parts), amount, reveal, badge, tone);
    }
}

public sealed record GiftSection(string Title, IReadOnlyList<GiftItem> Items);

public static class GiftGrouping
{
    /// <summary>Gifts grouped by occasion and year ("Christmas · 2025"), in the order the API returns them (newest first).</summary>
    public static List<GiftSection> ByOccasionAndYear(IEnumerable<Gift> gifts, string currency)
    {
        var sections = new List<(string Title, List<GiftItem> Items)>();
        foreach (var g in gifts)
        {
            var year = (g.OccasionDate ?? g.Date).ToUniversalTime().Year;
            var title = $"{g.OccasionName ?? "Other gifts"} · {year}";
            var section = sections.FirstOrDefault(s => s.Title == title);
            if (section.Items is null) { section = (title, []); sections.Add(section); }
            section.Items.Add(GiftItem.From(g, currency, showYear: false));
        }
        return sections.Select(s => new GiftSection(s.Title, s.Items)).ToList();
    }

    /// <summary>Gifts grouped by calendar year, newest first.</summary>
    public static List<GiftSection> ByYear(IEnumerable<Gift> gifts, string currency) =>
        gifts.GroupBy(g => g.Date.ToUniversalTime().Year)
            .OrderByDescending(g => g.Key)
            .Select(g => new GiftSection(g.Key.ToString(System.Globalization.CultureInfo.InvariantCulture), g.Select(x => GiftItem.From(x, currency, showYear: false)).ToList()))
            .ToList();
}

/// <summary>One option in a "who is this for / from" picker: a person or a whole family.</summary>
public sealed record SubjectOption(string Label, string? PersonId, string? FamilyId)
{
    public static List<SubjectOption> Build(IEnumerable<PersonListItem> people, IEnumerable<FamilyListItem> families) =>
        people.Select(p => new SubjectOption($"{p.Name} ({p.FamilyName})", p.Id, null))
            .Concat(families.Select(f => new SubjectOption($"{f.Name} (whole family)", null, f.Id)))
            .ToList();
}

/// <summary>Screens that load data when shown. The generated LoadCommand satisfies it.</summary>
public interface ILoadable
{
    CommunityToolkit.Mvvm.Input.IAsyncRelayCommand LoadCommand { get; }
}
