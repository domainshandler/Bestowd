using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;
using Bestowd.Core.Formatting;
using Bestowd.Core.Models;

namespace Bestowd.Core.ViewModels;

public sealed partial class PersonFormViewModel(BestowdApi api, INavigator nav, DataChanged changes) : FormViewModel(nav, changes), INavigationTarget, ILoadable
{
    private Dictionary<string, string> _otherSizes = [];
    [ObservableProperty] public partial string FamilyId { get; private set; } = "";
    [ObservableProperty] public partial string? PersonId { get; private set; }
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(SaveCommand))] public partial string Name { get; set; } = "";
    [ObservableProperty] public partial string Relationship { get; set; } = "";
    /// <summary>0 = unknown, else 1–12.</summary>
    [ObservableProperty] public partial int BirthMonth { get; set; }
    [ObservableProperty] public partial string BirthDay { get; set; } = "";
    [ObservableProperty] public partial string BirthYear { get; set; } = "";
    [ObservableProperty] public partial string Likes { get; set; } = "";
    [ObservableProperty] public partial string Avoid { get; set; } = "";
    [ObservableProperty] public partial string ClothingSize { get; set; } = "";
    [ObservableProperty] public partial string ShoeSize { get; set; } = "";
    [ObservableProperty] public partial string FoodNotes { get; set; } = "";
    [ObservableProperty] public partial string Notes { get; set; } = "";

    public IReadOnlyList<string> Months { get; } = ["Month", .. CultureInfo.InvariantCulture.DateTimeFormat.MonthNames.Take(12)];
    public string Title => PersonId is null ? "Add person" : $"Edit {Name}";

    public void Apply(IDictionary<string, object> parameters)
    {
        FamilyId = Params.Get(parameters, Params.FamilyId) ?? "";
        PersonId = Params.Get(parameters, Params.Id);
        OnPropertyChanged(nameof(Title));
    }

    [RelayCommand]
    public Task LoadAsync() => PersonId is null ? Task.CompletedTask : RunAsync(async () =>
    {
        var x = await api.GetPersonAsync(PersonId);
        Name = x.Name; Relationship = x.Relationship ?? ""; BirthMonth = x.BirthMonth ?? 0;
        BirthDay = x.BirthDay?.ToString(CultureInfo.CurrentCulture) ?? ""; BirthYear = x.BirthYear?.ToString(CultureInfo.CurrentCulture) ?? "";
        Likes = string.Join(", ", x.Likes); Avoid = string.Join(", ", x.Avoid);
        ClothingSize = x.Sizes.GetValueOrDefault("Clothing") ?? ""; ShoeSize = x.Sizes.GetValueOrDefault("Shoes") ?? "";
        _otherSizes = x.Sizes.Where(kv => kv.Key is not ("Clothing" or "Shoes")).ToDictionary();
        FoodNotes = x.FoodNotes ?? ""; Notes = x.Notes ?? "";
        OnPropertyChanged(nameof(Title));
    });

    private bool CanSave() => Name.Trim().Length > 0;

    public Dictionary<string, string> Sizes()
    {
        var sizes = new Dictionary<string, string>(_otherSizes);
        if (ClothingSize.Trim() is { Length: > 0 } c) sizes["Clothing"] = c;
        if (ShoeSize.Trim() is { Length: > 0 } s) sizes["Shoes"] = s;
        return sizes;
    }

    [RelayCommand(CanExecute = nameof(CanSave))]
    public async Task SaveAsync()
    {
        int? day = null, year = null;
        if (!Validate(() =>
        {
            day = BirthMonth == 0 ? null : ParseInt(BirthDay, 1, 31, "Day");
            year = ParseInt(BirthYear, 1900, DateTime.UtcNow.Year, "Year");
        })) return;
        string? Text(string s) => s.Trim() is { Length: > 0 } t ? t : null;
        int? month = BirthMonth == 0 ? null : BirthMonth;

        await SaveAndCloseAsync(() => PersonId is null
            ? api.CreatePersonAsync(FamilyId, new PersonBody
            {
                Name = Name.Trim(), Relationship = Text(Relationship), BirthMonth = month, BirthDay = day, BirthYear = year,
                Likes = Format.SplitList(Likes), Avoid = Format.SplitList(Avoid), Sizes = Sizes(), FoodNotes = Text(FoodNotes), Notes = Text(Notes),
            })
            : api.UpdatePersonAsync(PersonId, new Patch()
                .Set("name", Name.Trim()).Set("relationship", Text(Relationship))
                .Set("birthMonth", month).Set("birthDay", day).Set("birthYear", year)
                .Set("likes", Format.SplitList(Likes)).Set("avoid", Format.SplitList(Avoid)).Set("sizes", Sizes())
                .Set("foodNotes", Text(FoodNotes)).Set("notes", Text(Notes))));
    }
}
