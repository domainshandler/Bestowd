import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.tsx'
import ProtectedRoute from './auth/ProtectedRoute.tsx'
import { GroupProvider } from './groups/GroupContext.tsx'
import Layout from './components/Layout.tsx'
import LoginPage from './pages/LoginPage.tsx'
import HomePage from './pages/HomePage.tsx'
import PeoplePage from './pages/PeoplePage.tsx'
import FamilyPage from './pages/FamilyPage.tsx'
import PersonPage from './pages/PersonPage.tsx'
import GiftsPage from './pages/GiftsPage.tsx'
import IdeasPage from './pages/IdeasPage.tsx'
import JoinPage from './pages/JoinPage.tsx'
import AccountPage from './pages/AccountPage.tsx'
import GroupOccasionPage from './pages/GroupOccasionPage.tsx'
import MoveRequestPage from './pages/MoveRequestPage.tsx'

export default function App() {
  return (
    <AuthProvider>
      <GroupProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/join/:token" element={<JoinPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/families/:id" element={<FamilyPage />} />
              <Route path="/people/:id" element={<PersonPage />} />
              <Route path="/gifts" element={<GiftsPage />} />
              <Route path="/ideas" element={<IdeasPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/occasions/:id" element={<GroupOccasionPage />} />
              <Route path="/move-requests/:id" element={<MoveRequestPage />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GroupProvider>
    </AuthProvider>
  )
}
