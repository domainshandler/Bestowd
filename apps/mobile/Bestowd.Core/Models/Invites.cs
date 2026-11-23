namespace Bestowd.Core.Models;

// Invite links and joining.
// Request bodies: null properties are left out, so the API applies its defaults.

public sealed class InviteLink
{
    public string Token { get; init; } = "";
    public string Url { get; init; } = "";
    public DateTime ExpiresAt { get; init; }
}

public sealed class InvitePreview
{
    public InviteKind Kind { get; init; }
    public string InviterName { get; init; } = "";
    public string GroupName { get; init; } = "";
    public string? FamilyName { get; init; }
    public DateTime ExpiresAt { get; init; }
}

public sealed class AcceptInviteResult
{
    public string? ConnectionId { get; init; }
    public string? GroupId { get; init; }
    public bool AlreadyMember { get; init; }
    public string? MoveRequestId { get; init; }
}

public sealed class CreateInviteBody
{
    public InviteKind Kind { get; init; }
    public string? FamilyId { get; init; }
}

public sealed class AcceptInviteBody
{
    public string? SourceFamilyId { get; init; }
    public List<string>? SharedFields { get; init; }
    /// <summary>Group invites: what to bring from your own group. The group's owner approves it.</summary>
    public MoveSelection? Bring { get; init; }
}
