import { Link } from 'react-router-dom'
import type { Gift } from '@bestowd/types'

export default function GiftCard({ gift }: { gift: Gift }) {
  return (
    <Link
      to={`/gifts/${gift.id}`}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
    >
      {gift.imageUrl ? (
        <img src={gift.imageUrl} alt={gift.title} className="w-12 h-12 rounded-lg object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center text-2xl">🎁</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{gift.title}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          {gift.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      </div>
      {gift.type === 'basket' && (
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">Basket</span>
      )}
    </Link>
  )
}
