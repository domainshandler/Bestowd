using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public sealed partial class FamilyFormViewModel(BestowdApi api, INavigator nav, DataChanged changes) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private string _groupId = "";
    [ObservableProperty] public partial string? FamilyId { get; private set; }
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Name { get; set; } = "";
    [ObservableProperty] public partial FamilyType Type { get; set; } = FamilyType.Family;
    [ObservableProperty] public partial string Notes { get; set; } = "";

    public IReadOnlyList<FamilyType> Types { get; } = Enum.GetValues<FamilyType>();
    public string Title => FamilyId is null ? "Add family" : "Edit family";

    public void Apply(IDictionary<string, object> p)
    {
        _groupId = Params.Get(p, Params.GroupId) ?? "";
        FamilyId = Params.Get(p, Params.Id);
        OnPropertyChanged(nameof(Title));
    }

    [RelayCommand]
    public Task LoadAsync() => FamilyId is null ? Task.CompletedTask : RunAsync(async () =>
    {
        var f = await api.GetFamilyAsync(FamilyId);
        Name = f.Name; Type = f.Type; Notes = f.Notes ?? "";
    });

    private bool CanSave() => Name.Trim().Length > 0;

    [RelayCommand(CanExecute = nameof(CanSave))]
    public Task SaveAsync() => SaveAndCloseAsync(() => FamilyId is null
        ? api.CreateFamilyAsync(_groupId, new CreateFamilyBody { Name = Name.Trim(), Type = Type, Notes = Notes.Trim() is { Length: > 0 } n ? n : null })
        : api.UpdateFamilyAsync(FamilyId, new Patch().Set("name", Name.Trim()).SetEnum("type", Type).Set("notes", Notes.Trim() is { Length: > 0 } n2 ? n2 : null)));
}
