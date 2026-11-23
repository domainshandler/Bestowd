using System.Globalization;
using CommunityToolkit.Mvvm.Input;

namespace Bestowd.Core.ViewModels;

/// <summary>Shared save flow: validate, call the API, tell open screens, go back.</summary>
public abstract partial class FormViewModel(INavigator nav, DataChanged changes) : ViewModelBase
{
    protected INavigator Nav { get; } = nav;

    protected async Task SaveAndCloseAsync(Func<Task> save)
    {
        if (await RunAsync(save))
        {
            changes.Notify();
            await Nav.GoBackAsync();
        }
    }

    [RelayCommand] public Task CancelAsync() => Nav.GoBackAsync();

    /// <summary>A product link must be a web address.</summary>
    protected static void CheckLink(string? text)
    {
        if (text?.Trim() is { Length: > 0 } u && !(u.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || u.StartsWith("http://", StringComparison.OrdinalIgnoreCase)))
            throw new FormException("Links start with https://");
    }

    protected static decimal? ParseMoney(string? text) =>
        string.IsNullOrWhiteSpace(text) ? null
        : decimal.TryParse(text, NumberStyles.Number, CultureInfo.CurrentCulture, out var d) && d >= 0 ? d
        : throw new FormException("Enter an amount like 25 or 24.50.");

    protected static int? ParseInt(string? text, int min, int max, string what) =>
        string.IsNullOrWhiteSpace(text) ? null
        : int.TryParse(text, out var n) && n >= min && n <= max ? n
        : throw new FormException($"{what} must be between {min} and {max}.");

    /// <summary>Validation failure shown as the form's error.</summary>
    protected sealed class FormException(string message) : Exception(message);

    protected bool Validate(Action check)
    {
        try { check(); Error = null; return true; }
        catch (FormException e) { Error = e.Message; return false; }
    }
}
