using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public sealed partial class OccasionFormViewModel(BestowdApi api, INavigator nav, DataChanged changes) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private string _groupId = "";
    [ObservableProperty] public partial string? FixedPersonId { get; private set; }
    [ObservableProperty] public partial string? FixedFamilyId { get; private set; }
    [ObservableProperty] public partial IReadOnlyList<SubjectOption> Subjects { get; private set; } = [];
    [ObservableProperty] public partial SubjectOption? Subject { get; set; }
    [ObservableProperty] public partial OccasionType Type { get; set; } = OccasionType.Birthday;
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Name { get; set; } = "";
    [ObservableProperty] public partial DateTime Date { get; set; } = DateTime.Today;
    [ObservableProperty] public partial bool RecursAnnually { get; set; } = true;
    [ObservableProperty] public partial string Budget { get; set; } = "";
    [ObservableProperty] public partial bool NeedsCard { get; set; }
    [ObservableProperty] public partial string Location { get; set; } = "";
    [ObservableProperty] public partial string HostGiftRequest { get; set; } = "";

    public IReadOnlyList<OccasionType> Types { get; } = Enum.GetValues<OccasionType>();
    public bool ChoosesSubject => FixedPersonId is null && FixedFamilyId is null;

    partial void OnTypeChanged(OccasionType value) => RecursAnnually = value != OccasionType.OneOff;

    public void Apply(IDictionary<string, object> parameters)
    {
        _groupId = Params.Get(parameters, Params.GroupId) ?? "";
        FixedPersonId = Params.Get(parameters, Params.PersonId);
        FixedFamilyId = FixedPersonId is null ? Params.Get(parameters, Params.FamilyId) : null;
        if (Params.Get(parameters, Params.SubjectName) is { } name) Name = $"{name}'s birthday";
        OnPropertyChanged(nameof(ChoosesSubject));
    }

    [RelayCommand]
    public Task LoadAsync() => !ChoosesSubject ? Task.CompletedTask : RunAsync(async () =>
    {
        var people = api.ListPeopleAsync(_groupId);
        var families = api.ListFamiliesAsync(_groupId);
        Subjects = SubjectOption.Build(await people, await families);
    });

    private bool CanSave() => Name.Trim().Length > 0;

    public CreateOccasionBody? BuildBody()
    {
        decimal? budget = null;
        if (!Validate(() => budget = ParseMoney(Budget))) return null;
        var personId = FixedPersonId ?? Subject?.PersonId;
        var familyId = FixedFamilyId ?? Subject?.FamilyId;
        if (personId is null && familyId is null) { Error = "Choose who it's for."; return null; }
        string? Text(string s) => s.Trim() is { Length: > 0 } t ? t : null;
        return new CreateOccasionBody
        {
            Type = Type, Name = Name.Trim(), Date = DateOnly.FromDateTime(Date).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            PersonId = personId, FamilyId = personId is null ? familyId : null,
            RecursAnnually = RecursAnnually, Budget = budget, NeedsCard = NeedsCard,
            Location = Text(Location), HostGiftRequest = Text(HostGiftRequest),
        };
    }

    [RelayCommand(CanExecute = nameof(CanSave))]
    public Task SaveAsync() => BuildBody() is { } body ? SaveAndCloseAsync(() => api.CreateOccasionAsync(_groupId, body)) : Task.CompletedTask;
}
