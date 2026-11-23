using System.Text.Json;
using System.Text.Json.Serialization;
using Bestowd.Core.Models;

namespace Bestowd.Core.Api;

/// <summary>Source-generated JSON metadata, so serialisation survives trimming in release builds.</summary>
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(AuthResult))]
[JsonSerializable(typeof(User))]
[JsonSerializable(typeof(Me))]
[JsonSerializable(typeof(Group))]
[JsonSerializable(typeof(Family))]
[JsonSerializable(typeof(List<FamilyListItem>))]
[JsonSerializable(typeof(FamilyProfile))]
[JsonSerializable(typeof(Person))]
[JsonSerializable(typeof(List<PersonListItem>))]
[JsonSerializable(typeof(PersonDetail))]
[JsonSerializable(typeof(Occasion))]
[JsonSerializable(typeof(HomeOccasions))]
[JsonSerializable(typeof(GroupOccasions))]
[JsonSerializable(typeof(HolidayChoices))]
[JsonSerializable(typeof(ChooseHolidaysBody))]
[JsonSerializable(typeof(CreateGroupOccasionBody))]
[JsonSerializable(typeof(SetFamiliesBody))]
[JsonSerializable(typeof(Gift))]
[JsonSerializable(typeof(GiftList))]
[JsonSerializable(typeof(Idea))]
[JsonSerializable(typeof(IdeaList))]
[JsonSerializable(typeof(BuyIdeaResult))]
[JsonSerializable(typeof(InviteLink))]
[JsonSerializable(typeof(InvitePreview))]
[JsonSerializable(typeof(AcceptInviteResult))]
[JsonSerializable(typeof(MovableResponse))]
[JsonSerializable(typeof(MoveSelection))]
[JsonSerializable(typeof(MoveRequestSummary))]
[JsonSerializable(typeof(List<MoveRequestSummary>))]
[JsonSerializable(typeof(MoveRequestDetail))]
[JsonSerializable(typeof(ApproveMoveBody))]
[JsonSerializable(typeof(LeaveGroupBody))]
[JsonSerializable(typeof(LeaveGroupResult))]
[JsonSerializable(typeof(LeaveOptions))]
[JsonSerializable(typeof(CreateGroupBody))]
[JsonSerializable(typeof(StatusResult))]
[JsonSerializable(typeof(ErrorBody))]
[JsonSerializable(typeof(GoogleLoginBody))]
[JsonSerializable(typeof(CreateFamilyBody))]
[JsonSerializable(typeof(PersonBody))]
[JsonSerializable(typeof(CreateOccasionBody))]
[JsonSerializable(typeof(CreateGiftBody))]
[JsonSerializable(typeof(CreateIdeaBody))]
[JsonSerializable(typeof(BuyIdeaBody))]
[JsonSerializable(typeof(CreateInviteBody))]
[JsonSerializable(typeof(AcceptInviteBody))]
[JsonSerializable(typeof(RegisterDeviceBody))]
public sealed partial class ApiJson : JsonSerializerContext
{
    /// <summary>The API's name for an enum value, e.g. OccasionStatus.NotStarted → "NOT_STARTED".</summary>
    public static string EnumName<T>(T value) where T : struct, Enum =>
        JsonNamingPolicy.SnakeCaseUpper.ConvertName(value.ToString());
}
