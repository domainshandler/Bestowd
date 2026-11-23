using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bestowd.Core.Models;

// Enums the API sends as UPPER_SNAKE strings, and the converter that maps them.

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

[JsonConverter(typeof(SnakeEnum<MoveStatus>))] public enum MoveStatus { Pending, Approved, Declined, Cancelled }
