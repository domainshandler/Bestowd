using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class OccasionFormPage : BasePage<OccasionFormViewModel>
{
    public OccasionFormPage(OccasionFormViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
