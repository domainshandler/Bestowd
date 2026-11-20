import { useMutation, useQueryClient } from '@tanstack/react-query'

/** A mutation that refreshes all cached queries on success, then runs onDone. */
export function useSave<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, onDone?: (result: TResult) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await qc.invalidateQueries()
      onDone?.(result)
    },
  })
}

export function splitList(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter(Boolean)
}

export const numberOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s))
