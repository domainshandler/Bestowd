using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class PeoplePage : BasePage<PeopleViewModel>
{
    public PeoplePage(PeopleViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();

    private void OnFamilies(object? sender, EventArgs e) => Show(everyone: false);
    private void OnEveryone(object? sender, EventArgs e) => Show(everyone: true);

    private void Show(bool everyone)
    {
        ViewModel.ShowEveryone = everyone;
        FamiliesButton.Style = Ui.S(everyone ? "ChipOff" : "ChipOn");
        EveryoneButton.Style = Ui.S(everyone ? "ChipOn" : "ChipOff");
    }
}
