using System.Globalization;
using Bestowd.Core.Models;

namespace Bestowd.Core.Formatting;

/// <summary>Display helpers. The API stores calendar dates as UTC midnight, so dates are read in UTC.</summary>
public static class Format
{
    private static readonly string[] Months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    public static DateTime TodayUtc(DateTime? now = null)
    {
        var n = (now ?? DateTime.UtcNow).ToUniversalTime();
        return new DateTime(n.Year, n.Month, n.Day, 0, 0, 0, DateTimeKind.Utc);
    }

    private static DateTime Utc(DateTime d) => d.Kind == DateTimeKind.Utc ? d : d.ToUniversalTime();

    /// <summary>"Nov 22".</summary>
    public static string ShortDate(DateTime d) { var u = Utc(d); return $"{Months[u.Month - 1]} {u.Day}"; }

    /// <summary>"Sat, Nov 22".</summary>
    public static string DayDate(DateTime d) { var u = Utc(d); return $"{u.DayOfWeek.ToString()[..3]}, {Months[u.Month - 1]} {u.Day}"; }

    /// <summary>"Dec 2025".</summary>
    /// <summary>"Fri, Dec 25, 2026".</summary>
    public static string LongDate(DateTime d) { var u = Utc(d); return $"{u.DayOfWeek.ToString()[..3]}, {Months[u.Month - 1]} {u.Day}, {u.Year}"; }
    public static string MonthYear(DateTime d) { var u = Utc(d); return $"{Months[u.Month - 1]} {u.Year}"; }

    public static string MonthShort(DateTime d) => Months[Utc(d).Month - 1].ToUpperInvariant();
    public static int Day(DateTime d) => Utc(d).Day;

    public static int DaysUntil(DateTime d, DateTime? now = null) => (int)Math.Round((Utc(d) - TodayUtc(now)).TotalDays);

    public static string InDays(DateTime d, DateTime? now = null) => DaysUntil(d, now) switch
    {
        0 => "Today",
        1 => "Tomorrow",
        var n when n > 0 => $"In {n} days",
        var n => $"{-n} days ago",
    };

    public static string Money(decimal? amount, string currency, CultureInfo? culture = null)
    {
        if (amount is null) return "";
        var c = (CultureInfo)(culture ?? CultureInfo.CurrentCulture).Clone();
        var nf = c.NumberFormat;
        nf.CurrencySymbol = CurrencySymbol(currency, c);
        nf.CurrencyDecimalDigits = decimal.Truncate(amount.Value) == amount.Value ? 0 : 2;
        return amount.Value.ToString("C", nf);
    }

    /// <summary>The local symbol when the currency is the culture's own ("$" for CAD in en-CA), else the ISO code.</summary>
    private static string CurrencySymbol(string currency, CultureInfo culture)
    {
        try
        {
            var region = new RegionInfo(culture.Name.Length > 0 ? culture.Name : "en-US");
            if (region.ISOCurrencySymbol == currency) return region.CurrencySymbol;
        }
        catch (ArgumentException) { /* neutral culture */ }
        return currency switch { "USD" or "CAD" or "AUD" or "NZD" => currency[..2] + "$", "EUR" => "€", "GBP" => "£", _ => currency + " " };
    }

    public static string Initials(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0) return "?";
        var s = parts[0][..1] + (parts.Length > 1 ? parts[^1][..1] : "");
        return s.ToUpperInvariant();
    }

    /// <summary>"Mar 9" from month/day parts; "" when the month is unknown.</summary>
    public static string Birthday(int? month, int? day) =>
        month is null ? "" : Months[month.Value - 1] + (day is null ? "" : $" {day}");

    public static string Label(OccasionType t) => t switch { OccasionType.Birthday => "Birthday", OccasionType.Holiday => "Holiday", _ => "Event" };
    public static string Label(FamilyType t) => t switch { FamilyType.Family => "Family", FamilyType.Friends => "Friends", FamilyType.School => "School", FamilyType.Neighbours => "Neighbours", _ => "Other" };
    public static string Label(OccasionStatus s) => s switch
    {
        OccasionStatus.NotStarted => "Needs gift",
        OccasionStatus.IdeaSaved => "Idea saved",
        OccasionStatus.Bought => "Bought",
        _ => "Given",
    };
    public static string Label(Reaction r) => r switch
    {
        Reaction.LovedIt => "Loved it",
        Reaction.LikedIt => "Liked it",
        Reaction.AlreadyHadIt => "Already had it",
        _ => "Not a hit",
    };

    /// <summary>Splits "Painting, Dinosaurs ," into ["Painting", "Dinosaurs"].</summary>
    public static List<string> SplitList(string? text) =>
        (text ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
}
