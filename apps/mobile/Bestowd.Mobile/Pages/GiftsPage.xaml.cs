using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class GiftsPage : BasePage<GiftsViewModel>
{
    public GiftsPage(GiftsViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
