import { Link } from 'react-router-dom'
import type { Contact } from '@bestowd/types'

export default function ContactCard({ contact }: { contact: Contact }) {
  return (
    <Link
      to={`/contacts/${contact.id}`}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
    >
      {contact.avatarUrl ? (
        <img src={contact.avatarUrl} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand font-semibold">
          {contact.name[0]?.toUpperCase()}
        </div>
      )}
      <div>
        <p className="font-medium text-gray-900">{contact.name}</p>
        {contact.email && <p className="text-xs text-gray-400">{contact.email}</p>}
      </div>
      {!contact.isManaged && (
        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>
      )}
    </Link>
  )
}
