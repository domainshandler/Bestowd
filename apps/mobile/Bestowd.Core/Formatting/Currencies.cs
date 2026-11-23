namespace Bestowd.Core.Formatting;

/// <summary>A currency the group can budget in.</summary>
public sealed record CurrencyOption(string Code, string Name)
{
    public string Label => $"{Code} · {Name}";
}

/// <summary>Currencies offered in settings (ISO 4217 codes). Keep in step with the web app's list.</summary>
public static class Currencies
{
    public static readonly IReadOnlyList<CurrencyOption> All =
    [
        new("CAD", "Canadian dollar"),
        new("USD", "US dollar"),
        new("EUR", "Euro"),
        new("GBP", "British pound"),
        new("AUD", "Australian dollar"),
        new("NZD", "New Zealand dollar"),
        new("INR", "Indian rupee"),
        new("PKR", "Pakistani rupee"),
        new("PHP", "Philippine peso"),
        new("MXN", "Mexican peso"),
        new("BRL", "Brazilian real"),
        new("JPY", "Japanese yen"),
        new("CNY", "Chinese yuan"),
        new("HKD", "Hong Kong dollar"),
        new("SGD", "Singapore dollar"),
        new("KRW", "South Korean won"),
        new("AED", "UAE dirham"),
        new("SAR", "Saudi riyal"),
        new("ZAR", "South African rand"),
        new("NGN", "Nigerian naira"),
        new("KES", "Kenyan shilling"),
        new("CHF", "Swiss franc"),
        new("SEK", "Swedish krona"),
        new("NOK", "Norwegian krone"),
        new("DKK", "Danish krone"),
        new("PLN", "Polish złoty"),
    ];

    /// <summary>The options, plus the group's current currency if it isn't in the list (so it still shows).</summary>
    public static IReadOnlyList<CurrencyOption> WithCurrent(string? code) =>
        code is { Length: 3 } c && All.All(o => o.Code != c) ? [.. All, new CurrencyOption(c, c)] : All;
}
