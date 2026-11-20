using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Pages;

/// <summary>
/// Binds a view model, passes navigation parameters to it, and loads it when shown —
/// again whenever something was saved elsewhere since it last loaded.
/// </summary>
public abstract class BasePage<TViewModel> : ContentPage, IQueryAttributable where TViewModel : ViewModelBase, ILoadable
{
    private readonly DataChanged _changes;
    private int _loadedVersion = -1;

    protected BasePage(TViewModel viewModel, DataChanged changes)
    {
        ViewModel = viewModel;
        BindingContext = viewModel;
        _changes = changes;
    }

    protected TViewModel ViewModel { get; }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (ViewModel is INavigationTarget target)
        {
            target.Apply(query);
            _loadedVersion = -1;
        }
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        if (_loadedVersion == _changes.Version) return;
        _loadedVersion = _changes.Version;
        await ViewModel.LoadCommand.ExecuteAsync(null);
    }
}
