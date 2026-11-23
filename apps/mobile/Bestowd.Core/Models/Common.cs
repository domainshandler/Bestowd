namespace Bestowd.Core.Models;

// Small shapes shared across areas.
// Request bodies: null properties are left out, so the API applies its defaults.

public sealed class CurrencyAmount
{
    public string Currency { get; init; } = "CAD";
    public decimal Amount { get; init; }
}

public sealed class StatusResult
{
    public string Status { get; init; } = "";
}

public sealed class ErrorBody
{
    public string? Error { get; init; }
}
