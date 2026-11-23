namespace Bestowd.Core.ViewModels;

/// <summary>Screen routes, shared by the app shell and the view models.</summary>
public static class Routes
{
    public const string Home = "//home";
    public const string People = "//people";
    public const string Gifts = "//gifts";
    public const string Ideas = "//ideas";
    public const string SignIn = "//signin";
    public const string Family = "family";
    public const string Person = "person";
    public const string Account = "account";
    public const string Join = "join";
    public const string LogGift = "loggift";
    public const string FamilyForm = "familyform";
    public const string PersonForm = "personform";
    public const string OccasionForm = "occasionform";
    public const string IdeaForm = "ideaform";
    public const string GroupOccasion = "groupoccasion";
    public const string GroupOccasionForm = "groupoccasionform";
}

/// <summary>Navigation, implemented by the app with Shell.</summary>
public interface INavigator
{
    Task GoToAsync(string route, IDictionary<string, object>? parameters = null);
    Task GoBackAsync();
}

/// <summary>Dialogs and the share sheet, implemented by the app.</summary>
public interface IPrompts
{
    Task<bool> ConfirmAsync(string title, string message, string accept, string cancel = "Cancel");
    Task AlertAsync(string title, string message);
    Task ShareAsync(string title, string text);
}

/// <summary>Raised after any save, so screens that are already open refresh when shown again.</summary>
public sealed class DataChanged
{
    public event EventHandler? Changed;
    public int Version { get; private set; }
    public void Notify() { Version++; Changed?.Invoke(this, EventArgs.Empty); }
}
