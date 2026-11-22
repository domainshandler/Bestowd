# Bestowd mobile (.NET MAUI)

The iOS and Android app, on the same API as the web app. Plan: `docs/superpowers/plans/2026-11-20-maui-app.md`.

| Project | What it is |
|---|---|
| `Bestowd.Core` | `net10.0` library with everything testable: API client and models, Google sign-in (browser + PKCE, used on iOS), session, group state, formatting, and a view model for every screen and form |
| `Bestowd.Core.Tests` | xUnit tests for Core; they run on any OS |
| `Bestowd.Mobile` | The MAUI app: Shell tabs (Home, People, Gifts, Ideas), XAML pages bound to the Core view models, and platform glue |

## Build

Needs:
- the .NET 10 SDK;
- `dotnet workload install maui-android`, plus `maui-ios` on a Mac with Xcode;
- for Android, a JDK 17 and the Android SDK.

On Linux, set `USER` if your shell lacks it, because the Android SDK installer needs it.

```bash
dotnet test Bestowd.Core.Tests
dotnet build Bestowd.Mobile -t:InstallAndroidDependencies -f net10.0-android -p:AndroidSdkDirectory=$HOME/android-sdk -p:AcceptAndroidSDKLicenses=True   # once
dotnet build Bestowd.Mobile -f net10.0-android                    # debug APK in bin/Debug/net10.0-android
dotnet publish Bestowd.Mobile -c Release -f net10.0-android       # trimmed release AAB/APK
```

## Settings (MSBuild properties)

Each setting is passed with `-p:Name=value` and written into `BuildSettings.g.cs` at build time.

| Property | Default | Purpose |
|---|---|---|
| `BestowdApiUrl` | `http://10.0.2.2:3000` | The API. `10.0.2.2` is your machine as seen from the Android emulator. Debug builds allow plain `http`; release builds need `https`. |
| `BestowdWebUrl` | `http://localhost:5173` | The web app |
| `BestowdLinkHost` | `bestowd.app` | Host whose `https://<host>/join/<token>` invite links open the app |
| `GoogleWebClientId` | (empty) | The **Web** OAuth client ID, the same one as the API's `GOOGLE_CLIENT_ID`. Android sign-in uses it. |
| `GoogleIosClientId` | (empty) | iOS OAuth client ID |

Sign-in shows "Google sign-in isn't set up" until the client ID for the platform is set.

### Google sign-in setup

- **Android** uses Credential Manager ("Sign in with Google"), because Google no longer allows browser sign-in to redirect into Android apps.
  - The ID token it returns is issued for the Web client ID, which the API already accepts.
  - Also create an **Android** OAuth client with package `app.bestowd.mobile` and the SHA-1 of the signing key. Google uses it to recognise the app; its ID isn't put in the build.
  - Get the SHA-1 with `keytool -list -v -keystore <keystore> -alias <alias>`. Debug builds use the .NET debug keystore (`~/.local/share/Xamarin/Mono for Android/debug.keystore`, alias `androiddebugkey`, password `android`).
  - Before shipping, register the release key, or Google's app-signing key if you use Play App Signing.
- **iOS** signs in through the system browser with PKCE, redirecting to the reversed iOS client ID. The API must accept that client ID: add it to `GOOGLE_CLIENT_IDS` in `apps/api/.env`.

## Push reminders

Push is compiled in only when `Bestowd.Mobile/Platforms/Android/google-services.json` exists, which defines `FIREBASE`. To set it up:

1. Create a Firebase project and add an Android app with package name `app.bestowd.mobile`.
2. Download its `google-services.json` into `Platforms/Android/`. Keep it out of git if the repo is public.
3. Create a Firebase service account and put its JSON, on one line, in the API's `FCM_SERVICE_ACCOUNT`.

The app asks for notification permission after the first gift is logged, not at launch. It then registers the token with `POST /me/devices`, and removes it on sign-out.

## Invite links

The app handles `https://<BestowdLinkHost>/join/<token>`:
- **Android:** an App Links intent filter.
- **Verification:** for Android to open these links in the app without asking, the web host must serve `/.well-known/assetlinks.json` with the app's signing-certificate SHA-256 fingerprint.
- **Fallback:** without verification, the web app's `/join` page still works.

## iOS

Not built yet: this needs a Mac with Xcode. The Core library and pages are shared. The iOS-specific steps:

- **Google sign-in redirect:** add the reversed iOS client ID as a URL scheme (`CFBundleURLTypes`) in `Platforms/iOS/Info.plist`.
- **Invite links:** add `applinks:<BestowdLinkHost>` to Associated Domains in `Entitlements.plist`, and serve `/.well-known/apple-app-site-association` from the web host.
- **Push:** use APNs through FCM. Add the Firebase iOS app and `GoogleService-Info.plist`, then an iOS `IPushRegistration` (the Android one is in `Platforms/Android/FirebasePush.cs`).
- **Sign in with Apple:** the App Store requires it whenever an app offers Google sign-in. It's in roadmap step 6.
