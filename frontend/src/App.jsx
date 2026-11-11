import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import api from './lib/api'

import Login    from './pages/Login'
import Register from './pages/Register'
import Setup    from './pages/Setup'
import Swipe    from './pages/Swipe'
import Matches  from './pages/Matches'
import Game     from './pages/Game'
import Profile  from './pages/Profile'
import Navbar   from './components/Navbar'

// ---------------------------------------------------------------------------
// Protected route — redirects to /login if not authenticated
// ---------------------------------------------------------------------------
function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-400">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" />
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}

// ---------------------------------------------------------------------------
// Profile gate — redirects newly signed-up users to /setup if no profile yet
// ---------------------------------------------------------------------------
function ProfileGate() {
  const { user } = useAuth()
  const [hasProfile, setHasProfile] = useState(null) // null = still checking

  useEffect(() => {
    if (!user) return
    api.get('/profiles/me')
      .then(() => setHasProfile(true))
      .catch((err) => {
        // 404 means no profile yet
        if (err.message?.includes('not found') || err.message?.includes('404')) {
          setHasProfile(false)
        } else {
          // Network or other error — allow through to avoid blocking
          setHasProfile(true)
        }
      })
  }, [user])

  if (hasProfile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-400">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" />
      </div>
    )
  }

  if (!hasProfile) {
    return <Navigate to="/setup" replace />
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-400">
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </div>
      <Navbar />
    </div>
  )
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Must be authenticated */}
      <Route element={<ProtectedRoute />}>
        <Route path="/setup" element={<Setup />} />

        {/* Must have a completed profile */}
        <Route element={<ProfileGate />}>
          <Route path="/"        element={<Swipe />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/game/:gameId" element={<Game />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
