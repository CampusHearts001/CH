import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import api from './lib/api'

import Login from './pages/Login'
import Register from './pages/Register'
import Setup from './pages/Setup'
import Subscription from './pages/Subscription'
import Swipe from './pages/Swipe'
import Matches from './pages/Matches'
import Game from './pages/Game'
import Profile from './pages/Profile'
import Navbar from './components/Navbar'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-400">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" />
    </div>
  )
}

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

// Existing accounts are also checked. A failed status lookup never grants access.
function ProfileGate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [gate, setGate] = useState('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function check() {
      setGate('checking')
      setError('')
      try {
        await api.get('/profiles/me')
      } catch (err) {
        if (err.message?.toLowerCase().includes('profile not found') || err.message?.includes('404')) {
          if (alive) setGate('setup')
          return
        }
        if (alive) { setError(err.message); setGate('error') }
        return
      }

      try {
        const { data } = await api.get('/payments/status')
        if (!alive) return
        if (data.active) setGate('ready')
        else setGate('subscription')
      } catch (err) {
        if (alive) { setError(err.message); setGate('error') }
      }
    }
    if (user) check()
    return () => { alive = false }
  }, [user])

  if (gate === 'checking') return <LoadingScreen />
  if (gate === 'setup') return <Navigate to="/setup" replace />
  if (gate === 'subscription') return <Navigate to="/subscription" replace />
  if (gate === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-400 px-6 text-center">
        <h2 className="text-xl font-bold text-white">We couldn't verify your access</h2>
        <p className="text-white/60 text-sm mt-2">{error || 'Please check your connection and try again.'}</p>
        <button className="btn-primary mt-5" onClick={() => navigate(0)}>Try again</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-400">
      <div className="flex-1 overflow-y-auto pb-20"><Outlet /></div>
      <Navbar />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/setup" element={<Setup />} />
        <Route path="/subscription" element={<Subscription />} />

        <Route element={<ProfileGate />}>
          <Route path="/" element={<Swipe />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/game/:gameId" element={<Game />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter><AppRoutes /></BrowserRouter>
    </AuthProvider>
  )
}
