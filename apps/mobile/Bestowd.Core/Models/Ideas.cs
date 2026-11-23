namespace Bestowd.Core.Models;

// Gift ideas.
// Request bodies: null properties are left out, so the API applies its defaults.

public sealed class Repeat
{
    public string GiftEntryId { get; init; } = "";
    public string Title { get; init; } = "";
    public DateTime Date { get; init; }
}

public sealed class PersonRef
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
}

public sealed class Idea
{
    public string Id { get; init; } = "";
    public string GroupId { get; init; } = "";
    public string Title { get; init; } = "";
    public string? Brand { get; init; }
    public string? Store { get; init; }
    public string? Category { get; init; }
    public string? Url { get; init; }
    public string? ImageUrl { get; init; }
    public decimal? Price { get; init; }
    public string? Notes { get; init; }
    public int? AgeMin { get; init; }
    public int? AgeMax { get; init; }
    public IdeaStatus Status { get; init; }
    public string? OccasionId { get; init; }
    public List<PersonRef> People { get; init; } = [];
    public Repeat? Repeat { get; init; }
}

public sealed class IdeaPerson
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public int? Age { get; init; }
}

public sealed class IdeaList
{
    public IdeaPerson? Person { get; init; }
    public List<Idea> Ideas { get; init; } = [];
}

public sealed class BuyIdeaResult
{
    public Idea Idea { get; init; } = new();
    public Gift Gift { get; init; } = new();
}

public sealed class CreateIdeaBody
{
    public string Title { get; init; } = "";
    public string? Brand { get; init; }
    public string? Store { get; init; }
    public string? ImageUrl { get; init; }
    public string? Category { get; init; }
    public string? Url { get; init; }
    public decimal? Price { get; init; }
    public string? Notes { get; init; }
    public int? AgeMin { get; init; }
    public int? AgeMax { get; init; }
    public List<string>? PersonIds { get; init; }
    public string? OccasionId { get; init; }
}

public sealed class BuyIdeaBody
{
    public string? PersonId { get; init; }
    public string? FamilyId { get; init; }
    public string? OccasionId { get; init; }
    public decimal? Amount { get; init; }
}
