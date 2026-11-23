using Microsoft.Extensions.Logging;
using Bestowd.Core.Api;
using Bestowd.Core.Auth;
using Bestowd.Core.Groups;
using Bestowd.Core.ViewModels;
using Bestowd.Mobile.Pages;
using Bestowd.Mobile.Services;

namespace Bestowd.Mobile;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("Inter-Regular.ttf", "Inter");
                fonts.AddFont("Inter-Medium.ttf", "InterMedium");
                fonts.AddFont("Inter-SemiBold.ttf", "InterSemiBold");
                fonts.AddFont("PlusJakartaSans-Bold.ttf", "JakartaBold");
            });

        var s = builder.Services;
        s.AddSingleton(_ =>
        {
            var http = new HttpClient { BaseAddress = new Uri(BuildSettings.ApiUrl), Timeout = TimeSpan.FromSeconds(20) };
            // Tells the API (and its logs) which app build is calling.
            http.DefaultRequestHeaders.Add("X-Bestowd-Client", $"{DeviceInfo.Platform.ToString().ToLowerInvariant()}/{BuildSettings.AppBuild}");
            return http;
        });
        s.AddSingleton<ITokenStore, SecureTokenStore>();
        s.AddSingleton<ISettingsStore, PreferencesSettingsStore>();
        s.AddSingleton(sp => new BestowdApi(sp.GetRequiredService<HttpClient>(), sp.GetRequiredService<ITokenStore>()));
        s.AddSingleton<GroupState>();
        s.AddSingleton<DataChanged>();
        s.AddSingleton<INavigator, ShellNavigator>();
        s.AddSingleton<IPrompts, MauiPrompts>();
#if FIREBASE
        s.AddSingleton<IPushRegistration, Platforms.Android.FirebasePushRegistration>();
#else
        s.AddSingleton<IPushRegistration, NoPush>();
#endif
        s.AddSingleton<Session>();
        s.AddSingleton(sp => new GoogleAuthService(new HttpClient()));

        // Tabs keep their state; detail screens and forms are fresh each time.
        s.AddSingleton<HomeViewModel>().AddSingleton<HomePage>();
        s.AddSingleton<PeopleViewModel>().AddSingleton<PeoplePage>();
        s.AddSingleton<GiftsViewModel>().AddSingleton<GiftsPage>();
        s.AddSingleton<IdeasViewModel>().AddSingleton<IdeasPage>();
        s.AddTransient<FamilyViewModel>().AddTransient<FamilyPage>();
        s.AddTransient<PersonViewModel>().AddTransient<PersonPage>();
        s.AddTransient<JoinViewModel>().AddTransient<JoinPage>();
        s.AddTransient<AccountViewModel>().AddTransient<AccountPage>();
        s.AddTransient<FamilyFormViewModel>().AddTransient<FamilyFormPage>();
        s.AddTransient<PersonFormViewModel>().AddTransient<PersonFormPage>();
        s.AddTransient<OccasionFormViewModel>().AddTransient<OccasionFormPage>();
        s.AddTransient<GroupOccasionViewModel>().AddTransient<GroupOccasionPage>();
        s.AddTransient<GroupOccasionFormViewModel>().AddTransient<GroupOccasionFormPage>();
        s.AddTransient<HolidayChoiceViewModel>().AddTransient<HolidayChoicePage>();
        s.AddTransient<MoveRequestViewModel>().AddTransient<MoveRequestPage>();
        s.AddTransient<BringViewModel>().AddTransient<BringPage>();
        s.AddTransient<LeaveViewModel>().AddTransient<LeavePage>();
        s.AddTransient<LogGiftViewModel>().AddTransient<LogGiftPage>();
        s.AddTransient<IdeaFormViewModel>().AddTransient<IdeaFormPage>();
        s.AddTransient<SignInPage>().AddTransient<LaunchPage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif
        return builder.Build();
    }
}
