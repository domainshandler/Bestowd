using Android.App;
using Android.Runtime;

namespace Bestowd.Mobile;

#if DEBUG
// Debug builds talk to a local API over http (http://10.0.2.2:3000 from the emulator). Release builds require https.
[Application(UsesCleartextTraffic = true)]
#else
[Application]
#endif
public class MainApplication : MauiApplication
{
    public MainApplication(IntPtr handle, JniHandleOwnership ownership)
        : base(handle, ownership)
    {
    }

    protected override MauiApp CreateMauiApp() => MauiProgram.CreateMauiApp();
}
