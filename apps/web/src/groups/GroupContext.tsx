import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '@bestowd/api-client'
import type { Me, Membership } from '@bestowd/types'
import { useAuth } from '../auth/useAuth.ts'

export const GROUP_KEY = 'bestowd_group'

export interface GroupContextValue {
  me: Me | undefined
  isLoading: boolean
  isError: boolean
  /** The group People, Gifts and Ideas show. Null until /me has loaded. */
  groupId: string | null
  group: Membership | null
  memberships: Membership[]
  multipleGroups: boolean
  setGroupId: (groupId: string) => void
}

const GroupContext = createContext<GroupContextValue | null>(null)

export function GroupProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const { data: me, isLoading, isError } = useQuery({ queryKey: ['me', token], queryFn: getMe, enabled: Boolean(token) })
  const [chosen, setChosen] = useState<string | null>(() => localStorage.getItem(GROUP_KEY))

  const setGroupId = useCallback((id: string) => {
    localStorage.setItem(GROUP_KEY, id)
    setChosen(id)
  }, [])

  const value = useMemo<GroupContextValue>(() => {
    const memberships = me?.memberships ?? []
    // Fall back to the primary group when nothing is stored or the stored group is gone.
    const valid = memberships.find((m) => m.groupId === chosen)
    const group = valid ?? memberships.find((m) => m.groupId === me?.primaryGroupId) ?? memberships[0] ?? null
    return {
      me,
      isLoading,
      isError,
      groupId: group?.groupId ?? null,
      group,
      memberships,
      multipleGroups: memberships.length > 1,
      setGroupId,
    }
  }, [me, isLoading, isError, chosen, setGroupId])

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

export function useGroup(): GroupContextValue {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup must be used within GroupProvider')
  return ctx
}

/** For pages that need a group: the current group id (pages render a loading state until it's known). */
export function useGroupId(): string | null {
  return useGroup().groupId
}
