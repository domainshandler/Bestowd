using Bestowd.Core.Auth;
using Bestowd.Core.Groups;
using Bestowd.Core.Models;
using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

public class CaptureTests
{
    [Fact]
    public async Task Fill_in_from_link_fills_what_was_found_and_keeps_the_rest()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("GET /groups/g1/ai", """{"provider":null,"configured":false}""");
        handler.On("POST /groups/g1/capture/link", """{"draft":{"title":"Forerunner 165","brand":"Garmin","price":329.99,"currency":"CAD","store":"Best Buy","url":"https://shop/w","imageUrl":"https://shop/w.jpg"}}""");
        string title = "", brand = "", store = "", price = "", url = "https://shop/w"; string? photo = null;
        var helper = new CaptureHelper(api, () => "g1", new DraftTargets(
            v => title = v, v => brand = v, v => store = v, v => price = v, v => url = v, v => photo = v, () => url, () => photo));

        await helper.LoadAsync();
        Assert.False(helper.CanReadPhotos);
        await helper.FromLinkCommand.ExecuteAsync(null);
        Assert.Equal(("Forerunner 165", "Garmin", "Best Buy"), (title, brand, store));
        Assert.Equal(329.99m.ToString(System.Globalization.CultureInfo.CurrentCulture), price);
        Assert.Equal("https://shop/w.jpg", photo);
        Assert.StartsWith("Filled in the name, brand, store, price, picture.", helper.Note);
        Assert.EndsWith("CAD.", helper.Note);
    }

    [Fact]
    public async Task Without_a_link_it_says_what_to_do_and_errors_are_shown()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("POST /groups/g1/capture/photo", """{"error":"Reading photos needs an AI key."}""", System.Net.HttpStatusCode.Conflict);
        string? photo = "/files/g1/a.jpg?sig=x";
        var helper = new CaptureHelper(api, () => "g1", new DraftTargets(_ => { }, _ => { }, _ => { }, _ => { }, _ => { }, v => photo = v, () => "", () => photo));
        await helper.FromLinkCommand.ExecuteAsync(null);
        Assert.Equal("Paste a link starting with https:// first.", helper.Error);
        await helper.FromPhotoCommand.ExecuteAsync(null);
        Assert.Equal("Reading photos needs an AI key.", helper.Error);
    }

    [Fact]
    public void Account_shows_ai_status_and_keeps_the_key_private()
    {
        var groups = new GroupState(new MemorySettingsStore());
        var (api, _, _) = Fake.Api();
        var vm = new AccountViewModel(api, new Session(api, new Api.MemoryTokenStore(), groups, new NoPush(), new MemorySettingsStore()), groups, new FakeNavigator(), new FakePrompts());
        vm.SetAi(new AiSettings { Provider = "openai", Model = "gpt-x", KeyHint = "abcd", Configured = true });
        Assert.Equal("openai", vm.AiProvider?.Value);
        Assert.Equal("", vm.AiKey);
        Assert.StartsWith("A key ending in abcd is saved.", vm.AiKeyHelp);
        Assert.Equal("Required: the model name from your provider's console.", vm.AiModelHelp);
    }
}
