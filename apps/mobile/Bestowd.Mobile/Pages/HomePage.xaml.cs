using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class HomePage : BasePage<HomeViewModel>
{
    public HomePage(HomeViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();

    protected override void OnAppearing()
    {
        GreetingLabel.Text = HomeViewModel.Greeting(DateTime.Now);
        base.OnAppearing();
    }
}
