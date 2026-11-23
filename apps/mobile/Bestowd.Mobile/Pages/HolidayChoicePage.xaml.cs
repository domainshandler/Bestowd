using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

public partial class HolidayChoicePage : BasePage<HolidayChoiceViewModel>
{
    public HolidayChoicePage(HolidayChoiceViewModel vm, DataChanged changes) : base(vm, changes) => InitializeComponent();
}
