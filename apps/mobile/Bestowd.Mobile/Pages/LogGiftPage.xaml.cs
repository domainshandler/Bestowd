using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class LogGiftPage : BasePage<LogGiftViewModel>
{
    public LogGiftPage(LogGiftViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
