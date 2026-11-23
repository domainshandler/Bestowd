namespace Bestowd.Core.Models;

// Photos, reading product details from a link or photo, and autofill.
// Request bodies: null properties are left out, so the API applies its defaults.

/// <summary>What capture (a store link or a photo) fills into the idea or gift form.</summary>
public sealed class ProductDraft
{
    public string? Title { get; init; }
    public string? Brand { get; init; }
    public decimal? Price { get; init; }
    public string? Currency { get; init; }
    public string? Store { get; init; }
    public string? Url { get; init; }
    public string? ImageUrl { get; init; }
}

public sealed class DraftResponse
{
    public ProductDraft Draft { get; init; } = new();
}

public sealed class CaptureLinkBody
{
    public string Url { get; init; } = "";
}

public sealed class CapturePhotoBody
{
    public string PhotoUrl { get; init; } = "";
}

/// <summary>The group's AI for reading photos: "anthropic", "openai" or "google". The key is never sent back.</summary>
public sealed class AiSettings
{
    public string? Provider { get; init; }
    public string? Model { get; init; }
    public string? DefaultModel { get; init; }
    public string? KeyHint { get; init; }
    public bool Configured { get; init; }
}

public sealed class SaveAiSettingsBody
{
    public string Provider { get; init; } = "";
    public string? Model { get; init; }
    public string? ApiKey { get; init; }
}

public sealed class Suggestion
{
    public string Value { get; init; } = "";
    /// <summary>"yours", "popular" or "common".</summary>
    public string Source { get; init; } = "";
}

public sealed class SuggestionList
{
    public List<Suggestion> Suggestions { get; init; } = [];
}

public sealed class PhotoUpload
{
    public string Url { get; init; } = "";
}
