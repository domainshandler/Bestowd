using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class LeavePage : BasePage<LeaveViewModel>
{
    public LeavePage(LeaveViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
