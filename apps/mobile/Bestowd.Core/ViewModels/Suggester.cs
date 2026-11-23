using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Bestowd.Core.Api;

namespace Bestowd.Core.ViewModels;

/// <summary>
/// Autofill for one text field: as the user types, suggestions from their group's past entries, popular
/// ones across Bestowd, then common ones. Tapping one fills the field.
/// </summary>
public sealed partial class Suggester(BestowdApi api, Func<string> groupId, string field, Action<string> fill) : ObservableObject, IDisposable
{
    /// <summary>Pause after typing before asking, so each keystroke doesn't send a request.</summary>
    public static TimeSpan Debounce { get; set; } = TimeSpan.FromMilliseconds(150);

    private CancellationTokenSource? _pending;
    private string? _filled;

    [ObservableProperty, NotifyPropertyChangedFor(nameof(HasItems))] public partial IReadOnlyList<string> Items { get; private set; } = [];
    public bool HasItems => Items.Count > 0;

    /// <summary>Call when the field's text changes.</summary>
    public async Task UpdateAsync(string text)
    {
        _pending?.Cancel();
        _pending?.Dispose();
        _pending = null;
        var q = text.Trim();
        if (q.Length == 0 || q == _filled) { Items = []; _filled = null; return; }
        var cts = _pending = new CancellationTokenSource();
        var token = cts.Token;
        try
        {
            await Task.Delay(Debounce, token);
            var found = await api.SuggestAsync(groupId(), field, q, token);
            if (!token.IsCancellationRequested) Items = found.Select(s => s.Value).Where(v => v != q).ToList();
        }
        catch (OperationCanceledException) { }
        catch (Exception e) when (e is ApiException or HttpRequestException) { Items = []; }
    }

    public void Dispose()
    {
        _pending?.Cancel();
        _pending?.Dispose();
        _pending = null;
    }

    [RelayCommand]
    public void Pick(string value)
    {
        _pending?.Cancel();
        _filled = value;
        Items = [];
        fill(value);
    }
}
