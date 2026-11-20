using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class FamilyFormPage : BasePage<FamilyFormViewModel>
{
    public FamilyFormPage(FamilyFormViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
