import type { AssignmentStatus } from '@bestowd/types'

const styles: Record<AssignmentStatus, string> = {
  idea: 'bg-gray-100 text-gray-600',
  purchased: 'bg-blue-100 text-blue-700',
  given: 'bg-green-100 text-green-700',
}

export default function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${styles[status]}`}>
      {status}
    </span>
  )
}
