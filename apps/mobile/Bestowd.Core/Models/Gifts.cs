namespace Bestowd.Core.Models;

// Gifts given and received.
// Request bodies: null properties are left out, so the API applies its defaults.

public sealed class GiftCredit
{
    public string PersonId { get; init; } = "";
    public string Name { get; init; } = "";
}

public sealed class Gift
{
    public string Id { get; init; } = "";
    public string GroupId { get; init; } = "";
    public GiftDirection Direction { get; init; }
    public string Title { get; init; } = "";
    public string? Brand { get; init; }
    public string? Store { get; init; }
    /// <summary>Product page.</summary>
    public string? Url { get; init; }
    public string? Category { get; init; }
    public string? OccasionId { get; init; }
    public DateTime? OccasionDate { get; init; }
    public string? OccasionName { get; init; }
    public DateTime Date { get; init; }
    public string? PersonId { get; init; }
    public string? FamilyId { get; init; }
    public string CounterpartyName { get; init; } = "";
    public decimal? Amount { get; init; }
    public GiftStatus? Status { get; init; }
    public bool ValueHidden { get; init; }
    public bool HasGiftReceipt { get; init; }
    public DateTime? ReturnBy { get; init; }
    public bool ThankYouSent { get; init; }
    public DateTime? ThankYouDueAt { get; init; }
    public Reaction? Reaction { get; init; }
    public string? PhotoUrl { get; init; }
    public string? Notes { get; init; }
    public string? IdeaId { get; init; }
    public List<GiftCredit> Credits { get; init; } = [];
}

public sealed class GiftList
{
    public string Currency { get; init; } = "CAD";
    public List<Gift> Gifts { get; init; } = [];
    public GiftTotals Totals { get; init; } = new();
}

public sealed class CreateGiftBody
{
    public GiftDirection Direction { get; init; }
    public string Title { get; init; } = "";
    public string? Brand { get; init; }
    public string? Store { get; init; }
    public string? Url { get; init; }
    public string? PhotoUrl { get; init; }
    public string Date { get; init; } = "";
    public string? PersonId { get; init; }
    public string? FamilyId { get; init; }
    public string? Category { get; init; }
    public string? OccasionId { get; init; }
    public decimal? Amount { get; init; }
    public GiftStatus? Status { get; init; }
    public bool? ValueHidden { get; init; }
    public bool? HasGiftReceipt { get; init; }
    public string? ReturnBy { get; init; }
    public bool? ThankYouSent { get; init; }
    public Reaction? Reaction { get; init; }
    public string? Notes { get; init; }
    public List<string>? CreditPersonIds { get; init; }
    public string? IdeaId { get; init; }
}
