using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class PersonPage : BasePage<PersonViewModel>
{
    public PersonPage(PersonViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();

    private void OnGiven(object? sender, EventArgs e) => Show(received: false);
    private void OnReceived(object? sender, EventArgs e) => Show(received: true);

    private void Show(bool received)
    {
        ViewModel.ShowReceived = received;
        GivenButton.Style = Ui.S(received ? "ChipOff" : "ChipOn");
        ReceivedButton.Style = Ui.S(received ? "ChipOn" : "ChipOff");
    }
}
