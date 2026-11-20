using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class PersonFormPage : BasePage<PersonFormViewModel>
{
    public PersonFormPage(PersonFormViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
