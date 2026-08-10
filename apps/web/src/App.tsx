import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.tsx'
import ProtectedRoute from './auth/ProtectedRoute.tsx'
import Layout from './components/Layout.tsx'
import LoginPage from './pages/LoginPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ContactsPage from './pages/ContactsPage.tsx'
import ContactDetailPage from './pages/ContactDetailPage.tsx'
import EventsPage from './pages/EventsPage.tsx'
import GiftsPage from './pages/GiftsPage.tsx'
import GiftDetailPage from './pages/GiftDetailPage.tsx'
import AccountPage from './pages/AccountPage.tsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:id" element={<ContactDetailPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/gifts" element={<GiftsPage />} />
            <Route path="/gifts/:id" element={<GiftDetailPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
