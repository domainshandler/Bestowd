using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class AccountPage : BasePage<AccountViewModel>
{
    public AccountPage(AccountViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
