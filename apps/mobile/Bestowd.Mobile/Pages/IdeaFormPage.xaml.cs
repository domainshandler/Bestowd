using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class IdeaFormPage : BasePage<IdeaFormViewModel>
{
    public IdeaFormPage(IdeaFormViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
