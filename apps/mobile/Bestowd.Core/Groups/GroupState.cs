using CommunityToolkit.Mvvm.ComponentModel;
using Bestowd.Core.Models;

namespace Bestowd.Core.Groups;

/// <summary>Small key/value storage for preferences. The app uses MAUI Preferences.</summary>
public interface ISettingsStore
{
    string? Get(string key);
    void Set(string key, string? value);
}

public sealed class MemorySettingsStore : ISettingsStore
{
    private readonly Dictionary<string, string> _values = [];
    public string? Get(string key) => _values.GetValueOrDefault(key);
    public void Set(string key, string? value) { if (value is null) _values.Remove(key); else _values[key] = value; }
}

/// <summary>
/// Which group People, Gifts and Ideas show. Same rules as the web app: the stored choice if it's still one of
/// the user's groups, else the primary group, else the first. Home always covers every group.
/// </summary>
public sealed partial class GroupState(ISettingsStore settings) : ObservableObject
{
    public const string Key = "bestowd_group";

    [ObservableProperty] public partial Me? Me { get; private set; }
    [ObservableProperty] public partial Membership? Current { get; private set; }

    public IReadOnlyList<Membership> Memberships => Me?.Memberships ?? [];
    public bool MultipleGroups => Memberships.Count > 1;
    public string? GroupId => Current?.GroupId;

    public void Load(Me me)
    {
        Me = me;
        Resolve();
        OnPropertyChanged(nameof(Memberships));
        OnPropertyChanged(nameof(MultipleGroups));
    }

    public void Select(string groupId)
    {
        settings.Set(Key, groupId);
        Resolve();
    }

    public void Clear()
    {
        settings.Set(Key, null);
        Me = null;
        Current = null;
        OnPropertyChanged(nameof(Memberships));
        OnPropertyChanged(nameof(MultipleGroups));
    }

    private void Resolve()
    {
        var all = Memberships;
        var stored = settings.Get(Key);
        var next = all.FirstOrDefault(m => m.GroupId == stored)
            ?? all.FirstOrDefault(m => m.GroupId == Me?.PrimaryGroupId)
            ?? all.FirstOrDefault();
        if (next?.GroupId != Current?.GroupId || next != Current) Current = next;
        OnPropertyChanged(nameof(GroupId));
    }
}
