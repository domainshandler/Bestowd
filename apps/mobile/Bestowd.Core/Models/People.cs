namespace Bestowd.Core.Models;

// Families and the people in them.
// Request bodies: null properties are left out, so the API applies its defaults.

public class Family
{
    public string Id { get; init; } = "";
    public string GroupId { get; init; } = "";
    public string Name { get; init; } = "";
    public FamilyType Type { get; init; }
    public FamilyStatus Status { get; init; }
    public bool IsOwnHousehold { get; init; }
    public string? PhotoUrl { get; init; }
    public string? Notes { get; init; }
}

public sealed class NextOccasion
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public DateTime NextOccurrence { get; init; }
    public string? PersonName { get; init; }
}

public sealed class FamilyListItem : Family
{
    public int MemberCount { get; init; }
    public bool OnBestowd { get; init; }
    public NextOccasion? NextOccasion { get; init; }
}

public class Person
{
    public string Id { get; init; } = "";
    public string GroupId { get; init; } = "";
    public string FamilyId { get; init; } = "";
    public string Name { get; init; } = "";
    /// <summary>This person signs in to the group (they're in its household).</summary>
    public bool IsAccountHolder { get; init; }
    public string? Relationship { get; init; }
    public int? BirthMonth { get; init; }
    public int? BirthDay { get; init; }
    public int? BirthYear { get; init; }
    public List<string> Likes { get; init; } = [];
    public List<string> Avoid { get; init; } = [];
    public Dictionary<string, string> Sizes { get; init; } = [];
    public string? FoodNotes { get; init; }
    public string? PhotoUrl { get; init; }
    public string? Notes { get; init; }
    public DateTime? ArchivedAt { get; init; }
}

public sealed class PersonListItem : Person
{
    public int? Age { get; init; }
    public string FamilyName { get; init; } = "";
}

public sealed class ProfilePerson : Person
{
    public int? Age { get; init; }
    public DateTime? NextBirthday { get; init; }
}

public sealed class HistoryEntry
{
    public string Id { get; init; } = "";
    public GiftDirection Direction { get; init; }
    public string Title { get; init; } = "";
    public DateTime Date { get; init; }
    public Reaction? Reaction { get; init; }
}

public sealed class PersonDetail : Person
{
    public int? Age { get; init; }
    public string FamilyName { get; init; } = "";
    public List<HistoryEntry> History { get; init; } = [];
}

public sealed class SharedPerson
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public int? BirthMonth { get; init; }
    public int? BirthDay { get; init; }
    public int? BirthYear { get; init; }
    public List<string>? Likes { get; init; }
    public List<string>? Avoid { get; init; }
    public Dictionary<string, string>? Sizes { get; init; }
    public string? FoodNotes { get; init; }
    public string? PhotoUrl { get; init; }
}

public sealed class FamilyConnectionView
{
    public string Id { get; init; } = "";
    public string SourceFamilyName { get; init; } = "";
    public List<string> SharedFields { get; init; } = [];
    public List<SharedPerson> People { get; init; } = [];
}

public sealed class GiftTotals
{
    public int GivenCount { get; init; }
    public int ReceivedCount { get; init; }
    public decimal Spent { get; init; }
    public decimal ReceivedValue { get; init; }
    public int HiddenReceivedCount { get; init; }
    public int ThankYouDueCount { get; init; }
}

public sealed class FamilyProfile : Family
{
    public List<ProfilePerson> People { get; init; } = [];
    public List<Occasion> Occasions { get; init; } = [];
    public GiftTotals Totals { get; init; } = new();
    public FamilyConnectionView? Connection { get; init; }
}

public sealed class CreateFamilyBody
{
    public string Name { get; init; } = "";
    public FamilyType? Type { get; init; }
    public string? Notes { get; init; }
}

public sealed class PersonBody
{
    public string Name { get; init; } = "";
    public string? Relationship { get; init; }
    public int? BirthMonth { get; init; }
    public int? BirthDay { get; init; }
    public int? BirthYear { get; init; }
    public List<string>? Likes { get; init; }
    public List<string>? Avoid { get; init; }
    public Dictionary<string, string>? Sizes { get; init; }
    public string? FoodNotes { get; init; }
    public string? Notes { get; init; }
}
