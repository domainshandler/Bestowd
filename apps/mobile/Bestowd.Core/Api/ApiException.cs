using System.Net;

namespace Bestowd.Core.Api;

/// <summary>An API error: the HTTP status and the API's <c>{ error }</c> message.</summary>
public sealed class ApiException(HttpStatusCode status, string message) : Exception(message)
{
    public HttpStatusCode Status { get; } = status;
    public bool IsUnauthorized => Status == HttpStatusCode.Unauthorized;
    public bool IsNotFound => Status == HttpStatusCode.NotFound;
    /// <summary>410: an invite link that was used or has expired.</summary>
    public bool IsGone => Status == HttpStatusCode.Gone;
}
