using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class GroupOccasionPage : BasePage<GroupOccasionViewModel>
{
    public GroupOccasionPage(GroupOccasionViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
