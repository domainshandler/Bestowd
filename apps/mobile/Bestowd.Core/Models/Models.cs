using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bestowd.Core.Models;

/// <summary>Serialises an enum as the API's UPPER_SNAKE names (NotStarted ⇄ "NOT_STARTED"). Trim-safe.</summary>
public sealed class SnakeEnum<T> : JsonStringEnumConverter<T> where T : struct, Enum
{
    public SnakeEnum() : base(JsonNamingPolicy.SnakeCaseUpper, allowIntegerValues: false) { }
}

[JsonConverter(typeof(SnakeEnum<MembershipRole>))] public enum MembershipRole { Owner, Member }
[JsonConverter(typeof(SnakeEnum<FamilyType>))] public enum FamilyType { Family, Friends, School, Neighbours, Other }
[JsonConverter(typeof(SnakeEnum<FamilyStatus>))] public enum FamilyStatus { Active, Paused, Archived }
[JsonConverter(typeof(SnakeEnum<OccasionType>))] public enum OccasionType { Birthday, Holiday, OneOff }
[JsonConverter(typeof(SnakeEnum<OccasionStatus>))] public enum OccasionStatus { NotStarted, IdeaSaved, Bought, Given }
[JsonConverter(typeof(SnakeEnum<Rsvp>))] public enum Rsvp { None, Yes, No, Maybe }
[JsonConverter(typeof(SnakeEnum<GiftDirection>))] public enum GiftDirection { Given, Received }
[JsonConverter(typeof(SnakeEnum<GiftStatus>))] public enum GiftStatus { Bought, Given }
[JsonConverter(typeof(SnakeEnum<Reaction>))] public enum Reaction { LovedIt, LikedIt, AlreadyHadIt, NotAHit }
[JsonConverter(typeof(SnakeEnum<IdeaStatus>))] public enum IdeaStatus { Saved, Bought, Dismissed }
[JsonConverter(typeof(SnakeEnum<InviteKind>))] public enum InviteKind { Family, Group }
[JsonConverter(typeof(SnakeEnum<DevicePlatform>))] public enum DevicePlatform { Android, Ios }
[JsonConverter(typeof(SnakeEnum<OccasionScope>))] public enum OccasionScope { Subject, Group }

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

public sealed class Occasion
{
    public string Id { get; init; } = "";
    public string GroupId { get; init; } = "";
    public string GroupName { get; init; } = "";
    public string Currency { get; init; } = "CAD";
    public string? PersonId { get; init; }
    public string? FamilyId { get; init; }
    /// <summary>Group: no person or family of its own; it covers families (see <see cref="Coverage"/>).</summary>
    public OccasionScope Scope { get; init; }
    /// <summary>A built-in holiday (group-wide only), e.g. "christmas".</summary>
    public string? HolidayKey { get; init; }
    public OccasionType Type { get; init; }
    public string Name { get; init; } = "";
    public DateTime Date { get; init; }
    public bool RecursAnnually { get; init; }
    public DateTime? RecurrenceEndsAt { get; init; }
    public DateTime? NextOccurrence { get; init; }
    public decimal? Budget { get; init; }
    /// <summary>Group-wide: budget per family type (FAMILY, SCHOOL, …), overriding <see cref="Budget"/>.</summary>
    public Dictionary<string, decimal> FamilyTypeBudgets { get; init; } = [];
    public bool IncludeNewFamilies { get; init; } = true;
    public OccasionStatus Status { get; init; }
    public bool NeedsCard { get; init; }
    public bool CardDone { get; init; }
    public List<int> ReminderDays { get; init; } = [];
    public DateTime? PartyAt { get; init; }
    public string? Location { get; init; }
    public Rsvp Rsvp { get; init; }
    public string? HostGiftRequest { get; init; }
    public string SubjectName { get; init; } = "";
    public string? SubjectFamilyId { get; init; }
    public string? SubjectFamilyName { get; init; }
    public decimal? EffectiveBudget { get; init; }
    public decimal Spent { get; init; }
    public bool OverBudget { get; init; }
    public bool NeedsGift { get; init; }
    /// <summary>Group-wide only: the covered (active) families with their budgets and progress.</summary>
    public OccasionCoverage? Coverage { get; init; }

    public bool IsGroupWide => Scope == OccasionScope.Group;
}

public sealed class FamilyShare
{
    public string FamilyId { get; init; } = "";
    public string Name { get; init; } = "";
    public FamilyType Type { get; init; }
    /// <summary>This family's own budget, if set.</summary>
    public decimal? BudgetOverride { get; init; }
    /// <summary>The budget that applies: override, else family type budget, else the occasion's, else the group default.</summary>
    public decimal? Budget { get; init; }
    public decimal Spent { get; init; }
    /// <summary>A gift for this family is bought or given.</summary>
    public bool Covered { get; init; }
    public bool Given { get; init; }
}

public sealed class OccasionCoverage
{
    public int FamilyCount { get; init; }
    public int CoveredCount { get; init; }
    public List<FamilyShare> Families { get; init; } = [];
}

/// <summary>A built-in holiday, its next date and the group's occasion for it (if added).</summary>
public sealed class Holiday
{
    public string Key { get; init; } = "";
    public string Name { get; init; } = "";
    public string? Note { get; init; }
    public DateTime? NextDate { get; init; }
    public string? OccasionId { get; init; }
    /// <summary>The group said it doesn't celebrate this one, so it isn't suggested.</summary>
    public bool Dismissed { get; init; }
}

/// <summary>GET /groups/:id/holidays.</summary>
public sealed class HolidayChoices
{
    /// <summary>False until the group answers "Which holidays do you celebrate?".</summary>
    public bool Chosen { get; init; }
    public List<Holiday> Holidays { get; init; } = [];
}

public sealed class ChooseHolidaysBody
{
    public List<string> Keys { get; init; } = [];
}

public sealed class CurrencyAmount
{
    public string Currency { get; init; } = "CAD";
    public decimal Amount { get; init; }
}

public sealed class HomeOccasions
{
    public List<Occasion> Occasions { get; init; } = [];
    public List<CurrencyAmount> PlannedSpend { get; init; } = [];
    public bool MultipleGroups { get; init; }
}

public sealed class GroupOccasions
{
    public string Currency { get; init; } = "CAD";
    public List<Occasion> Occasions { get; init; } = [];
    public decimal PlannedSpend { get; init; }
}

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

public sealed class Repeat
{
    public string GiftEntryId { get; init; } = "";
    public string Title { get; init; } = "";
    public DateTime Date { get; init; }
}

public sealed class PersonRef
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
}

public sealed class Idea
{
    public string Id { get; init; } = "";
    public string GroupId { get; init; } = "";
    public string Title { get; init; } = "";
    public string? Category { get; init; }
    public string? Url { get; init; }
    public string? ImageUrl { get; init; }
    public decimal? Price { get; init; }
    public string? Notes { get; init; }
    public int? AgeMin { get; init; }
    public int? AgeMax { get; init; }
    public IdeaStatus Status { get; init; }
    public string? OccasionId { get; init; }
    public List<PersonRef> People { get; init; } = [];
    public Repeat? Repeat { get; init; }
}

public sealed class IdeaPerson
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public int? Age { get; init; }
}

public sealed class IdeaList
{
    public IdeaPerson? Person { get; init; }
    public List<Idea> Ideas { get; init; } = [];
}

public sealed class BuyIdeaResult
{
    public Idea Idea { get; init; } = new();
    public Gift Gift { get; init; } = new();
}

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

[JsonConverter(typeof(SnakeEnum<MoveStatus>))] public enum MoveStatus { Pending, Approved, Declined, Cancelled }

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

/// <summary>Something the group's members should know, e.g. someone left.</summary>
public sealed class GroupNotice
{
    public string Id { get; init; } = "";
    public string Text { get; init; } = "";
    public DateTime CreatedAt { get; init; }
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

public sealed class CreateGroupBody
{
    public string? Name { get; init; }
}

public sealed class StatusResult
{
    public string Status { get; init; } = "";
}

public sealed class ErrorBody
{
    public string? Error { get; init; }
}

// ---- Request bodies for creates. Null properties are left out, so the API applies its defaults. ----

public sealed class GoogleLoginBody { public string IdToken { get; init; } = ""; }

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

public sealed class CreateOccasionBody
{
    public OccasionType Type { get; init; }
    public string Name { get; init; } = "";
    /// <summary>"YYYY-MM-DD".</summary>
    public string Date { get; init; } = "";
    public string? PersonId { get; init; }
    public string? FamilyId { get; init; }
    public bool? RecursAnnually { get; init; }
    public decimal? Budget { get; init; }
    public bool? NeedsCard { get; init; }
    public string? PartyAt { get; init; }
    public string? Location { get; init; }
    public string? HostGiftRequest { get; init; }
}

/// <summary>A group-wide occasion: a built-in holiday (name, type and date from the catalog) or your own.</summary>
public sealed class CreateGroupOccasionBody
{
    public bool GroupWide { get; init; } = true;
    public string? HolidayKey { get; init; }
    public OccasionType? Type { get; init; }
    public string? Name { get; init; }
    public string? Date { get; init; }
    public bool? RecursAnnually { get; init; }
    public decimal? Budget { get; init; }
    public Dictionary<string, decimal>? FamilyTypeBudgets { get; init; }
    public bool? IncludeNewFamilies { get; init; }
    public List<string>? FamilyIds { get; init; }
}

public sealed class FamilyBudget
{
    public string FamilyId { get; init; } = "";
    /// <summary>Null (omitted) = use the defaults.</summary>
    public decimal? Budget { get; init; }
}

public sealed class SetFamiliesBody
{
    public List<FamilyBudget> Families { get; init; } = [];
}

public sealed class CreateGiftBody
{
    public GiftDirection Direction { get; init; }
    public string Title { get; init; } = "";
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
}

public sealed class CreateIdeaBody
{
    public string Title { get; init; } = "";
    public string? Category { get; init; }
    public string? Url { get; init; }
    public decimal? Price { get; init; }
    public string? Notes { get; init; }
    public int? AgeMin { get; init; }
    public int? AgeMax { get; init; }
    public List<string>? PersonIds { get; init; }
    public string? OccasionId { get; init; }
}

public sealed class BuyIdeaBody
{
    public string? PersonId { get; init; }
    public string? FamilyId { get; init; }
    public string? OccasionId { get; init; }
    public decimal? Amount { get; init; }
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

public sealed class RegisterDeviceBody
{
    public DevicePlatform Platform { get; init; }
    public string Token { get; init; } = "";
}
