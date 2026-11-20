using System.Globalization;
using Bestowd.Core.ViewModels;

namespace Bestowd.Mobile.Converters;

static class Palette
{
    public static Color Get(string key) => Application.Current!.Resources.TryGetValue(key, out var v) && v is Color c ? c : Colors.Gray;
}

/// <summary>Badge background for a tone.</summary>
public sealed class ToneBackgroundConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => value switch
    {
        Tone.Brand => Palette.Get("BrandLight"),
        Tone.Amber => Palette.Get("AmberSoft"),
        Tone.Danger => Palette.Get("DangerSoft"),
        _ => Palette.Get("Chip"),
    };
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}

/// <summary>Badge text colour for a tone.</summary>
public sealed class ToneTextConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => value switch
    {
        Tone.Brand => Palette.Get("Brand"),
        Tone.Amber => Palette.Get("AmberInk"),
        Tone.Danger => Palette.Get("Danger"),
        _ => Palette.Get("ChipInk"),
    };
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}

/// <summary>True when the value is a non-empty string, a non-null object, or a non-empty list.</summary>
public sealed class HasValueConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var has = value switch
        {
            null => false,
            string s => s.Length > 0,
            System.Collections.ICollection c => c.Count > 0,
            _ => true,
        };
        return parameter is "invert" ? !has : has;
    }
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}

public sealed class InvertConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => value is not true;
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => value is not true;
}

/// <summary>Selected chip style when the bound value equals the parameter.</summary>
public sealed class ChipStyleConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var on = string.Equals(value?.ToString(), parameter?.ToString(), StringComparison.OrdinalIgnoreCase)
            || (value is null && parameter is "ALL" or "All");
        return Application.Current!.Resources[on ? "ChipOn" : "ChipOff"];
    }
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}

/// <summary>"2026" for a year, "All years" for null.</summary>
public sealed class YearLabelConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => value is int y ? y.ToString(culture) : "All years";
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}
