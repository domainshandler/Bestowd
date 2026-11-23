namespace Bestowd.Core.Models;

// Birthdays, holidays and events, and their budgets.
// Request bodies: null properties are left out, so the API applies its defaults.

public sealed class Occasion
{
    public string Id { get; init; } = "";
    public string GroupId { get; init; } = "";
    public string GroupName { get; init; } = "";
    public string Currency { get; init; } = "CAD";
    public string? PersonId { get; init; }
    public string? FamilyId { get; init; }
    /// <summary>Group: no person or family of its own; it covers families (see <see cref="Coverage"/>).</summary>
    public OccasionScope Scope { get; init; }
    /// <summary>A built-in holiday (group-wide only), e.g. "christmas".</summary>
    public string? HolidayKey { get; init; }
    public OccasionType Type { get; init; }
    public string Name { get; init; } = "";
    public DateTime Date { get; init; }
    public bool RecursAnnually { get; init; }
    public DateTime? RecurrenceEndsAt { get; init; }
    public DateTime? NextOccurrence { get; init; }
    public decimal? Budget { get; init; }
    /// <summary>Group-wide: budget per family type (FAMILY, SCHOOL, …), overriding <see cref="Budget"/>.</summary>
    public Dictionary<string, decimal> FamilyTypeBudgets { get; init; } = [];
    public bool IncludeNewFamilies { get; init; } = true;
    public OccasionStatus Status { get; init; }
    public bool NeedsCard { get; init; }
    public bool CardDone { get; init; }
    public List<int> ReminderDays { get; init; } = [];
    public DateTime? PartyAt { get; init; }
    public string? Location { get; init; }
    public Rsvp Rsvp { get; init; }
    public string? HostGiftRequest { get; init; }
    public string SubjectName { get; init; } = "";
    public string? SubjectFamilyId { get; init; }
    public string? SubjectFamilyName { get; init; }
    public decimal? EffectiveBudget { get; init; }
    public decimal Spent { get; init; }
    public bool OverBudget { get; init; }
    public bool NeedsGift { get; init; }
    /// <summary>Group-wide only: the covered (active) families with their budgets and progress.</summary>
    public OccasionCoverage? Coverage { get; init; }

    public bool IsGroupWide => Scope == OccasionScope.Group;
}

public sealed class FamilyShare
{
    public string FamilyId { get; init; } = "";
    public string Name { get; init; } = "";
    public FamilyType Type { get; init; }
    /// <summary>This family's own budget, if set.</summary>
    public decimal? BudgetOverride { get; init; }
    /// <summary>The budget that applies: override, else family type budget, else the occasion's, else the group default.</summary>
    public decimal? Budget { get; init; }
    public decimal Spent { get; init; }
    /// <summary>A gift for this family is bought or given.</summary>
    public bool Covered { get; init; }
    public bool Given { get; init; }
}

public sealed class OccasionCoverage
{
    public int FamilyCount { get; init; }
    public int CoveredCount { get; init; }
    public List<FamilyShare> Families { get; init; } = [];
}

/// <summary>A built-in holiday, its next date and the group's occasion for it (if added).</summary>
public sealed class Holiday
{
    public string Key { get; init; } = "";
    public string Name { get; init; } = "";
    public string? Note { get; init; }
    public DateTime? NextDate { get; init; }
    public string? OccasionId { get; init; }
    /// <summary>The group said it doesn't celebrate this one, so it isn't suggested.</summary>
    public bool Dismissed { get; init; }
}

/// <summary>GET /groups/:id/holidays.</summary>
public sealed class HolidayChoices
{
    /// <summary>False until the group answers "Which holidays do you celebrate?".</summary>
    public bool Chosen { get; init; }
    public List<Holiday> Holidays { get; init; } = [];
}

public sealed class ChooseHolidaysBody
{
    public List<string> Keys { get; init; } = [];
}

public sealed class HomeOccasions
{
    public List<Occasion> Occasions { get; init; } = [];
    public List<CurrencyAmount> PlannedSpend { get; init; } = [];
    public bool MultipleGroups { get; init; }
}

public sealed class GroupOccasions
{
    public string Currency { get; init; } = "CAD";
    public List<Occasion> Occasions { get; init; } = [];
    public decimal PlannedSpend { get; init; }
}

public sealed class CreateOccasionBody
{
    public OccasionType Type { get; init; }
    public string Name { get; init; } = "";
    /// <summary>"YYYY-MM-DD".</summary>
    public string Date { get; init; } = "";
    public string? PersonId { get; init; }
    public string? FamilyId { get; init; }
    public bool? RecursAnnually { get; init; }
    public decimal? Budget { get; init; }
    public bool? NeedsCard { get; init; }
    public string? PartyAt { get; init; }
    public string? Location { get; init; }
    public string? HostGiftRequest { get; init; }
}

/// <summary>A group-wide occasion: a built-in holiday (name, type and date from the catalog) or your own.</summary>
public sealed class CreateGroupOccasionBody
{
    public bool GroupWide { get; init; } = true;
    public string? HolidayKey { get; init; }
    public OccasionType? Type { get; init; }
    public string? Name { get; init; }
    public string? Date { get; init; }
    public bool? RecursAnnually { get; init; }
    public decimal? Budget { get; init; }
    public Dictionary<string, decimal>? FamilyTypeBudgets { get; init; }
    public bool? IncludeNewFamilies { get; init; }
    public List<string>? FamilyIds { get; init; }
}

public sealed class FamilyBudget
{
    public string FamilyId { get; init; } = "";
    /// <summary>Null (omitted) = use the defaults.</summary>
    public decimal? Budget { get; init; }
}

public sealed class SetFamiliesBody
{
    public List<FamilyBudget> Families { get; init; } = [];
}
