import { NavLink, Outlet } from 'react-router-dom'
import { Icon, cx } from './ui.tsx'
import GroupSwitcher from '../groups/GroupSwitcher.tsx'
import { useAuth } from '../auth/useAuth.ts'
import { Avatar } from './ui.tsx'

const TABS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/people', label: 'People', icon: 'people', end: false },
  { to: '/gifts', label: 'Gifts', icon: 'gift', end: false },
  { to: '/ideas', label: 'Ideas', icon: 'sparkle', end: false },
]

export default function Layout() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen md:flex">
      {/* Wide screens: sidebar */}
      <nav aria-label="Main" className="hidden md:flex w-60 shrink-0 flex-col gap-1 p-4 border-r border-line bg-white sticky top-0 h-screen">
        <p className="font-display text-2xl font-bold text-brand px-3 mb-6">Bestowd</p>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => cx('flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-[15px]', isActive ? 'bg-brand-light text-brand font-semibold' : 'text-muted hover:bg-ground font-medium')}
          >
            <Icon name={t.icon} size={22} />
            {t.label}
          </NavLink>
        ))}
        <div className="mt-auto flex flex-col gap-3">
          <GroupSwitcher className="px-3" />
          <NavLink
            to="/account"
            className={({ isActive }) => cx('flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-[15px]', isActive ? 'bg-brand-light text-brand font-semibold' : 'text-muted hover:bg-ground font-medium')}
          >
            <Avatar name={user?.name ?? '?'} photoUrl={user?.avatarUrl} size={28} />
            Settings
          </NavLink>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Phones: header with account and group switcher */}
        <header className="md:hidden flex items-center justify-between px-5 pt-4">
          <span className="font-display text-lg font-bold text-brand">Bestowd</span>
          <div className="flex items-center gap-2">
            <GroupSwitcher />
            <NavLink to="/account" aria-label="Settings" className="w-11 h-11 flex items-center justify-center rounded-full">
              <Avatar name={user?.name ?? '?'} photoUrl={user?.avatarUrl} size={32} />
            </NavLink>
          </div>
        </header>
        <main className="flex-1 w-full max-w-3xl mx-auto px-5 pt-4 pb-28 md:pb-10 md:pt-10">
          <Outlet />
        </main>
      </div>

      {/* Phones: bottom tab bar */}
      <nav aria-label="Tabs" className="md:hidden fixed bottom-0 inset-x-0 h-[84px] bg-white border-t border-line grid grid-cols-4 px-2 pt-2 pb-5 z-40">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cx('flex flex-col items-center justify-center gap-1', isActive ? 'text-brand' : 'text-muted')}>
            {({ isActive }) => (
              <>
                <span className={cx('w-14 h-[30px] rounded-[15px] flex items-center justify-center', isActive && 'bg-brand-light')}>
                  <Icon name={t.icon} size={22} />
                </span>
                <span className={cx('text-xs', isActive ? 'font-semibold' : 'font-medium')}>{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
