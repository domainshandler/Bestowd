using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class IdeasPage : BasePage<IdeasViewModel>
{
    public IdeasPage(IdeasViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
