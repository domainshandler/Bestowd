namespace Bestowd.Core.Api;

/// <summary>Where the session token lives. The app stores it in SecureStorage.</summary>
public interface ITokenStore
{
    Task<string?> GetAsync();
    Task SetAsync(string token);
    Task ClearAsync();
}

/// <summary>A token store held in memory, for tests and previews.</summary>
public sealed class MemoryTokenStore(string? token = null) : ITokenStore
{
    private string? _token = token;
    public Task<string?> GetAsync() => Task.FromResult(_token);
    public Task SetAsync(string token) { _token = token; return Task.CompletedTask; }
    public Task ClearAsync() { _token = null; return Task.CompletedTask; }
}
