using CommunityToolkit.Mvvm.ComponentModel;
using Bestowd.Core.Api;

namespace Bestowd.Core.ViewModels;

public abstract partial class ViewModelBase : ObservableObject
{
    [ObservableProperty] public partial bool IsBusy { get; protected set; }
    [ObservableProperty] public partial string? Error { get; protected set; }
    [ObservableProperty] public partial bool HasLoaded { get; protected set; }

    /// <summary>Runs work with a busy flag; API and network failures become <see cref="Error"/> instead of crashing.</summary>
    protected async Task<bool> RunAsync(Func<Task> work)
    {
        if (IsBusy) return false;
        IsBusy = true;
        Error = null;
        try
        {
            await work();
            return true;
        }
        catch (ApiException e) { Error = e.Message; }
        catch (HttpRequestException) { Error = "Can't reach Bestowd. Check your connection."; }
        catch (TaskCanceledException) { Error = "That took too long. Try again."; }
        finally { IsBusy = false; }
        return false;
    }
}
