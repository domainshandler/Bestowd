namespace Bestowd.Core.Models;

// Bringing families and gifts into a group, reviewed by its owner.
// Request bodies: null properties are left out, so the API applies its defaults.

/// <summary>What to bring from your own group into another. The receiving group's owner approves it.</summary>
public sealed class MoveSelection
{
    public List<string> FamilyIds { get; init; } = [];
    public List<string> OccasionIds { get; init; } = [];
    public bool Ideas { get; init; }
    public bool IsEmpty => FamilyIds.Count == 0 && OccasionIds.Count == 0 && !Ideas;
}

public sealed class MovableFamily
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public bool IsOwnHousehold { get; init; }
    public int People { get; init; }
    public int Gifts { get; init; }
}

public sealed class NamedRef
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
}

/// <summary>What you could bring from your own group (one you own and are alone in).</summary>
public sealed class MovableItems
{
    public string GroupId { get; init; } = "";
    public string GroupName { get; init; } = "";
    public List<MovableFamily> Families { get; init; } = [];
    public List<NamedRef> Occasions { get; init; } = [];
    public int Ideas { get; init; }
}

public sealed class MovableResponse
{
    public MovableItems? Movable { get; init; }
    /// <summary>A request from your group is already waiting for approval.</summary>
    public bool Pending { get; init; }
}

public sealed class MoveCounts
{
    public int Families { get; init; }
    public int People { get; init; }
    public int Gifts { get; init; }
    public int Occasions { get; init; }
    public int Ideas { get; init; }
}

public sealed class Requester
{
    public string UserId { get; init; } = "";
    public string Name { get; init; } = "";
}

public class MoveRequestSummary
{
    public string Id { get; init; } = "";
    public string GroupId { get; init; } = "";
    public string FromGroupName { get; init; } = "";
    public Requester RequestedBy { get; init; } = new();
    public MoveStatus Status { get; init; }
    public DateTime CreatedAt { get; init; }
    public MoveCounts Counts { get; init; } = new();
}

public sealed class ReviewFamily
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public bool IsOwnHousehold { get; init; }
    public int People { get; init; }
    public int Gifts { get; init; }
    public NamedRef? Match { get; init; }
}

public sealed class ReviewPerson
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string FamilyId { get; init; } = "";
    public NamedRef Match { get; init; } = new();
}

public sealed class ReviewOccasion
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public NamedRef? Match { get; init; }
    public bool BudgetDiffers { get; init; }
    public decimal? TheirBudget { get; init; }
    public decimal? OurBudget { get; init; }
}

public sealed class CurrencyPair
{
    public string From { get; init; } = "";
    public string To { get; init; } = "";
}

/// <summary>The owner's view of a pending request: the items, their look-alikes, and differences to decide.</summary>
public sealed class MoveReview
{
    public CurrencyPair? Currency { get; init; }
    public List<ReviewFamily> Families { get; init; } = [];
    public List<ReviewPerson> People { get; init; } = [];
    public List<ReviewOccasion> Occasions { get; init; } = [];
    public int Ideas { get; init; }
}

public sealed class MoveRequestDetail : MoveRequestSummary
{
    public bool CanDecide { get; init; }
    public MoveReview? Review { get; init; }
}

public sealed class ApproveMoveBody
{
    public List<string> FamilyIds { get; init; } = [];
    public List<string> OccasionIds { get; init; } = [];
    public bool Ideas { get; init; }
    public List<string> KeepBothFamilies { get; init; } = [];
    public List<string> KeepBothPeople { get; init; } = [];
    public List<string> UseTheirBudget { get; init; } = [];
}
