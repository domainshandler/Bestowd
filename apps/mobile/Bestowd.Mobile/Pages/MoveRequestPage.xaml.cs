using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class MoveRequestPage : BasePage<MoveRequestViewModel>
{
    public MoveRequestPage(MoveRequestViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
