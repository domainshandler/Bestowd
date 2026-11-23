import { useGroup } from './GroupContext.tsx'

/** Shown only to users in more than one group. */
export default function GroupSwitcher({ className = '' }: { className?: string }) {
  const { memberships, multipleGroups, groupId, setGroupId } = useGroup()
  if (!multipleGroups || !groupId) return null
  return (
    <label className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-muted">Group</span>
      <select
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        className="min-h-[36px] border border-line rounded-lg px-2 bg-white text-ink text-sm font-medium"
      >
        {memberships.map((m) => (
          <option key={m.groupId} value={m.groupId}>
            {m.groupName}
          </option>
        ))}
      </select>
    </label>
  )
}
