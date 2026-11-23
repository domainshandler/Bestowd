using Bestowd.Core.ViewModels;

namespace Bestowd.Core.Tests;

public class PhotoTests
{
    private sealed class FakePhotos(byte[]? photo) : IPhotoSource
    {
        public Task<byte[]?> TakeAsync() => Task.FromResult(photo);
        public Task<byte[]?> ChooseAsync() => Task.FromResult(photo);
    }

    [Fact]
    public async Task Taking_a_photo_uploads_it_and_keeps_the_link()
    {
        var (api, handler, _) = Fake.Api();
        handler.On("POST /groups/g1/photos", """{"url":"/files/g1/a.jpg?sig=x"}""");
        var slot = new PhotoSlot(api, new FakePhotos([0xff, 0xd8, 0xff, 1]), () => "g1");
        Assert.True(slot.CanPick);
        Assert.Equal("Take photo", slot.TakeText);

        await slot.TakeCommand.ExecuteAsync(null);
        Assert.Equal("/files/g1/a.jpg?sig=x", slot.Url);
        Assert.EndsWith("/files/g1/a.jpg?sig=x", slot.Source);
        Assert.Equal("Retake", slot.TakeText);

        slot.RemoveCommand.Execute(null);
        Assert.False(slot.HasPhoto);
    }

    [Fact]
    public async Task Cancelling_uploads_nothing_and_without_a_camera_there_is_nothing_to_pick()
    {
        var (api, handler, _) = Fake.Api();
        var slot = new PhotoSlot(api, new FakePhotos(null), () => "g1");
        await slot.ChooseCommand.ExecuteAsync(null);
        Assert.Null(slot.Url);
        Assert.Empty(handler.Requests);
        Assert.False(new PhotoSlot(api, null, () => "g1").CanPick);
    }
}
