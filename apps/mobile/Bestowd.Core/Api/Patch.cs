using System.Globalization;
using System.Text.Json.Nodes;

namespace Bestowd.Core.Api;

/// <summary>
/// A PATCH body. Only fields that are Set are sent, and Set(name, null) sends an explicit null
/// (which clears the field), so a partial update never wipes fields it doesn't mention.
/// </summary>
public sealed class Patch
{
    internal JsonObject Body { get; } = new();

    public Patch Set(string name, string? value) { Body[name] = value is null ? null : JsonValue.Create(value); return this; }
    public Patch Set(string name, bool value) { Body[name] = JsonValue.Create(value); return this; }
    public Patch Set(string name, int? value) { Body[name] = value is null ? null : JsonValue.Create(value.Value); return this; }
    public Patch Set(string name, decimal? value) { Body[name] = value is null ? null : JsonValue.Create(value.Value); return this; }

    public Patch Set(string name, IEnumerable<string> values)
    {
        var array = new JsonArray();
        foreach (var v in values) array.Add((JsonNode)JsonValue.Create(v));
        Body[name] = array;
        return this;
    }

    public Patch Set(string name, IReadOnlyDictionary<string, string> values)
    {
        var obj = new JsonObject();
        foreach (var (k, v) in values) obj[k] = JsonValue.Create(v);
        Body[name] = obj;
        return this;
    }

    public Patch Set(string name, IReadOnlyDictionary<string, decimal> values)
    {
        var obj = new JsonObject();
        foreach (var (k, v) in values) obj[k] = JsonValue.Create(v);
        Body[name] = obj;
        return this;
    }

    public Patch SetNumbers(string name, IEnumerable<int> values)
    {
        var array = new JsonArray();
        foreach (var v in values) array.Add((JsonNode)JsonValue.Create(v));
        Body[name] = array;
        return this;
    }

    /// <summary>A calendar date, sent as "YYYY-MM-DD".</summary>
    public Patch SetDate(string name, DateOnly? value) =>
        Set(name, value?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));

    public Patch SetEnum<T>(string name, T value) where T : struct, Enum => Set(name, ApiJson.EnumName(value));

    public Patch SetEnum<T>(string name, T? value) where T : struct, Enum =>
        Set(name, value is null ? null : ApiJson.EnumName(value.Value));

    public bool IsEmpty => Body.Count == 0;
    public string ToJson() => Body.ToJsonString();
}
