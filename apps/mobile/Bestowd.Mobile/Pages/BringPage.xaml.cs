using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class BringPage : BasePage<BringViewModel>
{
    public BringPage(BringViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
