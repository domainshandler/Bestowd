using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class FamilyPage : BasePage<FamilyViewModel>
{
    public FamilyPage(FamilyViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
