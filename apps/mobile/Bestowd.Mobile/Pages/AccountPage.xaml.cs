using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class AccountPage : BasePage<AccountViewModel>
{
    public AccountPage(AccountViewModel vm, DataChanged changes) : base(vm, changes)
    {
        InitializeComponent();
        // Shows which build is installed, e.g. "Bestowd 0.1 (1065401234) · built 2026-11-23 04:20 UTC".
        VersionLabel.Text = $"Bestowd {BuildSettings.AppVersion} · built {BuildSettings.BuildTime}";
    }
}
