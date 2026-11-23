using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

public class SuggestTests
{
    public SuggestTests() => Suggester.Debounce = TimeSpan.Zero;

    [Fact]
    public async Task Typing_asks_for_suggestions_and_picking_one_fills_the_field()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("GET /groups/g1/suggest?field=brand&q=ga", """{"suggestions":[{"value":"Garmin","source":"yours"},{"value":"Gap","source":"common"}]}""");
        string? filled = null;
        var s = new Suggester(api, () => "g1", "brand", v => filled = v);

        await s.UpdateAsync("ga");
        Assert.Equal(["Garmin", "Gap"], s.Items);
        Assert.True(s.HasItems);

        s.PickCommand.Execute("Garmin");
        Assert.Equal("Garmin", filled);
        Assert.False(s.HasItems);
        // Filling the field changes its text; that doesn't ask again.
        await s.UpdateAsync("Garmin");
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task Empty_text_clears_and_failures_show_nothing()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("GET /groups/g1/suggest?field=title&q=x", """{"error":"boom"}""", System.Net.HttpStatusCode.InternalServerError);
        var s = new Suggester(api, () => "g1", "title", _ => { });
        await s.UpdateAsync("x");
        Assert.False(s.HasItems);
        await s.UpdateAsync("   ");
        Assert.Empty(s.Items);
    }
}
