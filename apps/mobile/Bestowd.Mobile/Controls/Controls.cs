using System.Windows.Input;
using Microsoft.Maui.Controls.Shapes;
using Bestowd.Core.Auth;
using Bestowd.Core.Formatting;
using Bestowd.Core.ViewModels;
using Bestowd.Mobile.Converters;

namespace Bestowd.Mobile.Pages;

static class Ui
{
    public static Color C(string key) => Palette.Get(key);
    public static Style S(string key) => (Style)Application.Current!.Resources[key];

    public static Label Text(string? text = null, string style = "", double size = 0) =>
        new Label { Text = text, Style = style.Length > 0 ? S(style) : null, FontSize = size > 0 ? size : 15, LineBreakMode = LineBreakMode.TailTruncation };
}

/// <summary>A pill badge whose colours follow its <see cref="Tone"/>.</summary>
public sealed class Badge : Border
{
    public static readonly BindableProperty TextProperty = BindableProperty.Create(nameof(Text), typeof(string), typeof(Badge), propertyChanged: (b, _, n) => ((Badge)b).Update());
    public static readonly BindableProperty ToneProperty = BindableProperty.Create(nameof(Tone), typeof(Tone), typeof(Badge), Tone.Neutral, propertyChanged: (b, _, _) => ((Badge)b).Update());

    private readonly Label _label = new() { FontFamily = "InterSemiBold", FontSize = 12 };

    public Badge()
    {
        StrokeThickness = 0;
        StrokeShape = new RoundRectangle { CornerRadius = 999 };
        Padding = new Thickness(10, 4);
        VerticalOptions = LayoutOptions.Center;
        HorizontalOptions = LayoutOptions.Start;
        Content = _label;
        Update();
    }

    public string? Text { get => (string?)GetValue(TextProperty); set => SetValue(TextProperty, value); }
    public Tone Tone { get => (Tone)GetValue(ToneProperty); set => SetValue(ToneProperty, value); }

    private void Update()
    {
        _label.Text = Text;
        IsVisible = !string.IsNullOrEmpty(Text);
        BackgroundColor = (Color)new ToneBackgroundConverter().Convert(Tone, typeof(Color), null, System.Globalization.CultureInfo.CurrentCulture);
        _label.TextColor = (Color)new ToneTextConverter().Convert(Tone, typeof(Color), null, System.Globalization.CultureInfo.CurrentCulture);
    }
}

/// <summary>Initials in a circle.</summary>
public sealed class Avatar : Border
{
    public static readonly BindableProperty NameProperty = BindableProperty.Create(nameof(Name), typeof(string), typeof(Avatar), "", propertyChanged: (b, _, n) => ((Avatar)b)._label.Text = Format.Initials((string?)n ?? ""));
    public static readonly BindableProperty SizeProperty = BindableProperty.Create(nameof(Size), typeof(double), typeof(Avatar), 40d, propertyChanged: (b, _, n) => ((Avatar)b).Resize((double)n));

    private readonly Label _label = new() { FontFamily = "InterSemiBold", FontSize = 13, TextColor = Ui.C("Brand"), HorizontalOptions = LayoutOptions.Center, VerticalOptions = LayoutOptions.Center };

    public Avatar()
    {
        BackgroundColor = Ui.C("BrandLight");
        StrokeThickness = 0;
        Content = _label;
        Resize(40);
        SemanticProperties.SetDescription(this, "");
    }

    public string Name { get => (string)GetValue(NameProperty); set => SetValue(NameProperty, value); }
    public double Size { get => (double)GetValue(SizeProperty); set => SetValue(SizeProperty, value); }

    private void Resize(double size)
    {
        WidthRequest = HeightRequest = size;
        StrokeShape = new RoundRectangle { CornerRadius = size / 2 };
        _label.FontSize = Math.Max(12, size / 3);
    }
}

/// <summary>The signed-in user's initials; opens Account.</summary>
/// <summary>The settings button at the top right of every tab: opens Settings (account, group settings, holidays).</summary>
public sealed class AccountButton : Border
{
    public AccountButton()
    {
        WidthRequest = HeightRequest = 44;
        StrokeShape = new RoundRectangle { CornerRadius = 22 };
        Stroke = Ui.C("Line");
        BackgroundColor = Colors.White;
        VerticalOptions = LayoutOptions.Start;
        Content = new Image { Source = "settings_gear.png", WidthRequest = 22, HeightRequest = 22, HorizontalOptions = LayoutOptions.Center, VerticalOptions = LayoutOptions.Center };
        SemanticProperties.SetDescription(this, "Settings");
        GestureRecognizers.Add(new TapGestureRecognizer { Command = new Command(async () => await Shell.Current.GoToAsync(Routes.Account)) });
    }
}

/// <summary>Base for tappable list rows: a white card with a Command that receives the row's item.</summary>
public abstract class TappableRow : Border
{
    public static readonly BindableProperty CommandProperty = BindableProperty.Create(nameof(Command), typeof(ICommand), typeof(TappableRow));

    protected TappableRow()
    {
        Style = Ui.S("Card");
        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) => { if (Command?.CanExecute(BindingContext) == true) Command.Execute(BindingContext); };
        GestureRecognizers.Add(tap);
    }

    public ICommand? Command { get => (ICommand?)GetValue(CommandProperty); set => SetValue(CommandProperty, value); }
}

/// <summary>An occasion with its date tile and status (Home, Family, Person).</summary>
public sealed class OccasionRow : TappableRow
{
    public OccasionRow()
    {
        var month = new Label { FontFamily = "InterSemiBold", FontSize = 11, TextColor = Ui.C("Brand"), HorizontalOptions = LayoutOptions.Center };
        var day = new Label { FontFamily = "JakartaBold", FontSize = 20, TextColor = Ui.C("Brand"), HorizontalOptions = LayoutOptions.Center };
        month.SetBinding(Label.TextProperty, static (OccasionItem i) => i.Month);
        day.SetBinding(Label.TextProperty, static (OccasionItem i) => i.Day);
        var tile = new Border
        {
            WidthRequest = 52, HeightRequest = 56, BackgroundColor = Ui.C("BrandLight"), StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 12 },
            Content = new VerticalStackLayout { VerticalOptions = LayoutOptions.Center, Children = { month, day } },
        };

        var title = Ui.Text(style: "Strong");
        title.SetBinding(Label.TextProperty, static (OccasionItem i) => i.Title);
        var subtitle = Ui.Text(style: "Small");
        subtitle.SetBinding(Label.TextProperty, static (OccasionItem i) => i.Subtitle);

        var badge = new Badge();
        badge.SetBinding(Badge.TextProperty, static (OccasionItem i) => i.StatusText);
        badge.SetBinding(Badge.ToneProperty, static (OccasionItem i) => i.StatusTone);

        var grid = new Grid { ColumnDefinitions = Columns.Define(Auto, Star, Auto), ColumnSpacing = 14 };
        grid.Add(tile, 0);
        grid.Add(new VerticalStackLayout { Spacing = 3, VerticalOptions = LayoutOptions.Center, Children = { title, subtitle } }, 1);
        grid.Add(badge, 2);
        Content = grid;
    }

    private static GridLength Auto => GridLength.Auto;
    private static GridLength Star => GridLength.Star;
}

file static class Columns
{
    public static ColumnDefinitionCollection Define(params GridLength[] widths) => new(widths.Select(w => new ColumnDefinition(w)).ToArray());
}

/// <summary>A gift in a history list, with Show value and thank-you actions for received gifts.</summary>
public sealed class GiftRow : TappableRow
{
    public static readonly BindableProperty RevealCommandProperty = BindableProperty.Create(nameof(RevealCommand), typeof(ICommand), typeof(GiftRow));
    public static readonly BindableProperty ThankCommandProperty = BindableProperty.Create(nameof(ThankCommand), typeof(ICommand), typeof(GiftRow));

    public GiftRow()
    {
        StrokeThickness = 0;
        Padding = new Thickness(14, 12);
        var icon = new Label { FontFamily = "JakartaBold", FontSize = 18, HorizontalOptions = LayoutOptions.Center, VerticalOptions = LayoutOptions.Center };
        icon.SetBinding(Label.TextProperty, static (GiftItem g) => g.Arrow);
        icon.SetBinding(Label.TextColorProperty, static (GiftItem g) => g.IsReceived, converter: new BoolColor("AmberInk", "Brand"));
        icon.SetBinding(SemanticProperties.DescriptionProperty, static (GiftItem g) => g.DirectionText);
        var iconBox = new Border { WidthRequest = 40, HeightRequest = 40, StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 12 }, Content = icon };
        iconBox.SetBinding(BackgroundColorProperty, static (GiftItem g) => g.IsReceived, converter: new BoolColor("AmberSoft", "BrandLight"));

        var title = Ui.Text(style: "Strong");
        title.SetBinding(Label.TextProperty, static (GiftItem g) => g.Title);
        var line = Ui.Text(style: "Small");
        line.SetBinding(Label.TextProperty, static (GiftItem g) => g.Line);

        var amount = new Label { FontFamily = "InterSemiBold", HorizontalOptions = LayoutOptions.End };
        amount.SetBinding(Label.TextProperty, static (GiftItem g) => g.AmountText);
        amount.SetBinding(IsVisibleProperty, static (GiftItem g) => g.HasAmount);

        var reveal = new Button { Text = "Show value", Style = Ui.S("Ghost"), FontSize = 13, MinimumHeightRequest = 32, HeightRequest = 32, HorizontalOptions = LayoutOptions.End };
        reveal.SetBinding(IsVisibleProperty, static (GiftItem g) => g.ShowReveal);
        reveal.Clicked += (_, _) => { if (RevealCommand?.CanExecute(BindingContext) == true) RevealCommand.Execute(BindingContext); };

        var badge = new Badge { HorizontalOptions = LayoutOptions.End };
        badge.SetBinding(Badge.TextProperty, static (GiftItem g) => g.BadgeText);
        badge.SetBinding(Badge.ToneProperty, static (GiftItem g) => g.BadgeTone);
        var badgeTap = new TapGestureRecognizer();
        badgeTap.Tapped += (_, _) =>
        {
            if (BindingContext is GiftItem { CanMarkThanked: true } && ThankCommand?.CanExecute(BindingContext) == true) ThankCommand.Execute(BindingContext);
        };
        badge.GestureRecognizers.Add(badgeTap);

        var grid = new Grid { ColumnDefinitions = Columns.Define(GridLength.Auto, GridLength.Star, GridLength.Auto), ColumnSpacing = 12 };
        grid.Add(iconBox, 0);
        grid.Add(new VerticalStackLayout { Spacing = 2, VerticalOptions = LayoutOptions.Center, Children = { title, line } }, 1);
        grid.Add(new VerticalStackLayout { Spacing = 4, VerticalOptions = LayoutOptions.Center, Children = { amount, reveal, badge } }, 2);
        Content = grid;
    }

    public ICommand? RevealCommand { get => (ICommand?)GetValue(RevealCommandProperty); set => SetValue(RevealCommandProperty, value); }
    public ICommand? ThankCommand { get => (ICommand?)GetValue(ThankCommandProperty); set => SetValue(ThankCommandProperty, value); }
}

/// <summary>One palette colour when true, another when false.</summary>
public sealed class BoolColor(string whenTrue, string whenFalse) : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, System.Globalization.CultureInfo culture) => Ui.C(value is true ? whenTrue : whenFalse);
    public object ConvertBack(object? value, Type targetType, object? parameter, System.Globalization.CultureInfo culture) => throw new NotSupportedException();
}

/// <summary>A person's loves, avoid list, sizes and food note. Binds to a <see cref="NotesView"/>.</summary>
public sealed class NotesCard : Border
{
    public NotesCard()
    {
        Style = Ui.S("Card");
        Padding = 16;
        BindingContextChanged += (_, _) => Build();
    }

    private void Build()
    {
        var stack = new VerticalStackLayout { Spacing = 14 };
        if (BindingContext is not NotesView n) { Content = stack; return; }
        if (n.IsEmpty) stack.Add(new Label { Text = $"No notes for {n.Name} yet.", Style = Ui.S("Small") });
        if (n.Loves.Count > 0) stack.Add(Section("Loves", Tags(n.Loves, "BrandLight", "BrandDark")));
        if (n.Avoid.Count > 0) stack.Add(Section("Avoid", Tags(n.Avoid, "DangerSoft", "Danger")));
        if (n.Facts.Count > 0)
        {
            var grid = new Grid { ColumnDefinitions = { new(GridLength.Star), new(GridLength.Star) }, ColumnSpacing = 8, RowSpacing = 8 };
            for (var i = 0; i < n.Facts.Count; i++)
            {
                if (i % 2 == 0) grid.RowDefinitions.Add(new RowDefinition(GridLength.Auto));
                var cell = new Border
                {
                    BackgroundColor = Ui.C("Ground"), StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 10 }, Padding = 10,
                    Content = new VerticalStackLayout
                    {
                        Children =
                        {
                            new Label { Text = n.Facts[i].Label, FontSize = 12, TextColor = Ui.C("Muted") },
                            new Label { Text = n.Facts[i].Value, FontFamily = "InterSemiBold", FontSize = 14 },
                        },
                    },
                };
                grid.Add(cell, i % 2, i / 2);
            }
            stack.Add(grid);
        }
        if (!string.IsNullOrEmpty(n.Notes)) stack.Add(new Label { Text = n.Notes, FontSize = 14, TextColor = Ui.C("ChipInk") });
        Content = stack;
    }

    private static View Section(string title, View body) => new VerticalStackLayout
    {
        Spacing = 8,
        Children = { new Label { Text = title, Style = Ui.S("Caps") }, body },
    };

    private static FlexLayout Tags(IEnumerable<string> items, string bg, string fg)
    {
        var flex = new FlexLayout { Wrap = Microsoft.Maui.Layouts.FlexWrap.Wrap };
        foreach (var t in items)
            flex.Add(new Border
            {
                BackgroundColor = Ui.C(bg), StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 999 }, Padding = new Thickness(10, 6), Margin = new Thickness(0, 0, 6, 6),
                Content = new Label { Text = t, FontFamily = "InterMedium", FontSize = 13, TextColor = Ui.C(fg) },
            });
        return flex;
    }
}
