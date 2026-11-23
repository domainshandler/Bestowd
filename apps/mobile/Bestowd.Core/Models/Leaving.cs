namespace Bestowd.Core.Models;

// Leaving a group, with copies of chosen families.
// Request bodies: null properties are left out, so the API applies its defaults.

public sealed class LeaveCopy
{
    public List<string> FamilyIds { get; init; } = [];
    public bool? Ideas { get; init; }
    public string? ToGroupId { get; init; }
    public bool? ToNewGroup { get; init; }
}

public sealed class LeaveGroupBody
{
    public string? NewOwnerId { get; init; }
    public bool? DeleteGroup { get; init; }
    /// <summary>Families to take a copy of, with their people and gift history.</summary>
    public LeaveCopy? Copy { get; init; }
    /// <summary>Clear your birthday, likes, sizes and notes from the household you leave.</summary>
    public bool? ForgetMe { get; init; }
}

public sealed class CopiedCounts
{
    public int Families { get; init; }
    public int Gifts { get; init; }
    public int Ideas { get; init; }
}

public sealed class LeaveGroupResult
{
    public string PrimaryGroupId { get; init; } = "";
    public CopiedCounts Copied { get; init; } = new();
}

public sealed class LeaveDestination
{
    public string GroupId { get; init; } = "";
    public string GroupName { get; init; } = "";
}

/// <summary>Before leaving: families you could take a copy of, and your other groups to put them in.</summary>
public sealed class LeaveOptions
{
    public List<MovableFamily> Families { get; init; } = [];
    public int Ideas { get; init; }
    public List<LeaveDestination> Destinations { get; init; } = [];
}
