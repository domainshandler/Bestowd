using Bestowd.Core.Auth;
using Bestowd.Core.ViewModels;
using Bestowd.Mobile.Pages;

namespace Bestowd.Mobile;

public partial class AppShell : Shell
{
    private readonly IServiceProvider _services;

    public AppShell(IServiceProvider services)
    {
        InitializeComponent();
        _services = services;
        Routing.RegisterRoute(Routes.Family, typeof(FamilyPage));
        Routing.RegisterRoute(Routes.Person, typeof(PersonPage));
        Routing.RegisterRoute(Routes.Account, typeof(AccountPage));
        Routing.RegisterRoute(Routes.Join, typeof(JoinPage));
        Routing.RegisterRoute(Routes.LogGift, typeof(LogGiftPage));
        Routing.RegisterRoute(Routes.FamilyForm, typeof(FamilyFormPage));
        Routing.RegisterRoute(Routes.PersonForm, typeof(PersonFormPage));
        Routing.RegisterRoute(Routes.OccasionForm, typeof(OccasionFormPage));
        Routing.RegisterRoute(Routes.IdeaForm, typeof(IdeaFormPage));
        Routing.RegisterRoute(Routes.GroupOccasion, typeof(GroupOccasionPage));
        Routing.RegisterRoute(Routes.GroupOccasionForm, typeof(GroupOccasionFormPage));
    }

    /// <summary>True once the user is signed in and the tabs are showing.</summary>
    public bool IsReady { get; private set; }

    /// <summary>Called by the launch and sign-in pages once there is a session.</summary>
    public async Task ShowMainAsync()
    {
        IsReady = true;
        await GoToAsync(Routes.Home);
        await OpenPendingInviteAsync();
    }

    public async Task OpenPendingInviteAsync()
    {
        if (App.PendingInviteToken is not { } token) return;
        App.PendingInviteToken = null;
        await GoToAsync(Routes.Join, new Dictionary<string, object> { [Params.Token] = token });
    }

    public void SignedOut() => IsReady = false;

    public T Resolve<T>() where T : notnull => _services.GetRequiredService<T>();
}
