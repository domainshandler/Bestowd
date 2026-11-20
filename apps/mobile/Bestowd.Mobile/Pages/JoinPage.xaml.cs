using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class JoinPage : BasePage<JoinViewModel>
{
    public JoinPage(JoinViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
