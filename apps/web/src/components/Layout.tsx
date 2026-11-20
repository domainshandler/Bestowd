import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/dashboard', label: 'Home' },
  { to: '/account', label: 'Account' },
]

export default function Layout() {
  return (
    <div className="flex h-screen">
      <nav className="w-56 bg-brand-dark text-white flex flex-col gap-1 p-4 shrink-0">
        <p className="text-xl font-bold mb-6">Bestowd</p>
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-brand text-white' : 'text-purple-200 hover:bg-purple-700'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <Outlet />
      </main>
    </div>
  )
}
