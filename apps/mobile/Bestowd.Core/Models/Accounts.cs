namespace Bestowd.Core.Models;

// The signed-in user, their groups and memberships.
// Request bodies: null properties are left out, so the API applies its defaults.

public sealed class User
{
    public string Id { get; init; } = "";
    public string Email { get; init; } = "";
    public string Name { get; init; } = "";
    public string? AvatarUrl { get; init; }
    public string IdentitySource { get; init; } = "google";
    public bool EmailVerified { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class AuthResult
{
    public string Token { get; init; } = "";
    public User User { get; init; } = new();
}

public sealed class Membership
{
    public string GroupId { get; init; } = "";
    public string GroupName { get; init; } = "";
    public MembershipRole Role { get; init; }
    public int MemberCount { get; init; }
}

public sealed class Me
{
    public User User { get; init; } = new();
    public string? PrimaryGroupId { get; init; }
    public List<Membership> Memberships { get; init; } = [];
}

public sealed class GroupMember
{
    public string UserId { get; init; } = "";
    public string Name { get; init; } = "";
    public string? AvatarUrl { get; init; }
    public MembershipRole Role { get; init; }
}

public sealed class Group
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Currency { get; init; } = "CAD";
    public Dictionary<string, decimal> DefaultBudgets { get; init; } = [];
    public List<int> DefaultReminderDays { get; init; } = [];
    public List<GroupMember> Members { get; init; } = [];
}

/// <summary>Something the group's members should know, e.g. someone left.</summary>
public sealed class GroupNotice
{
    public string Id { get; init; } = "";
    public string Text { get; init; } = "";
    public DateTime CreatedAt { get; init; }
}

public sealed class CreateGroupBody
{
    public string? Name { get; init; }
}

public sealed class GoogleLoginBody { public string IdToken { get; init; } = ""; }

public sealed class RegisterDeviceBody
{
    public DevicePlatform Platform { get; init; }
    public string Token { get; init; } = "";
}
