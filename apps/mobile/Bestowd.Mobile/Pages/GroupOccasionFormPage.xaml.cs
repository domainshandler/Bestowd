using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class GroupOccasionFormPage : BasePage<GroupOccasionFormViewModel>
{
    public GroupOccasionFormPage(GroupOccasionFormViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
