import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isCollegeEmail, ALLOWED_EMAIL_DOMAINS } from '../lib/config'

export default function Register() {
  const navigate = useNavigate()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(false)
  const [needsConfirm, setNeedsConfirm] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isCollegeEmail(email)) {
      return setError(`Please use your college email (@${ALLOWED_EMAIL_DOMAINS[0]}).`)
    }

    if (password.length < 8) {
      return setError('Password must be at least 8 characters.')
    }

    if (password !== confirm) {
      return setError('Passwords do not match.')
    }

    setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // After email confirmation the user lands on /setup
          emailRedirectTo: `${window.location.origin}/setup`,
        },
      })
      if (signUpError) throw signUpError

      setSuccess(true)
      if (data.session) {
        // Email confirmation is off in Supabase: already signed in
        setTimeout(() => navigate('/setup'), 1200)
      } else {
        // Must click the link in the confirmation email first
        setNeedsConfirm(true)
      }
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-400 px-4">
      <div className="mb-8 text-center animate-fade-in">
        <div className="text-5xl mb-3">💘</div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">CampusMatch</h1>
        <p className="text-white/50 text-sm mt-1">Everyone here is single. Nobody ever sees a rejection.</p>
      </div>

      <div className="card w-full max-w-sm p-8 animate-fade-in">
        <h2 className="text-xl font-bold text-white mb-6">Create account</h2>

        {error && (
          <div className="bg-primary/10 border border-primary/30 text-primary-300 rounded-xl px-4 py-3 mb-5 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/30 border border-green-500/30 text-green-400 rounded-xl px-4 py-3 mb-5 text-sm">
            {needsConfirm
              ? 'Almost there! We sent a confirmation link to your college email. Open it, then sign in.'
              : 'Account created! Redirecting to profile setup…'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              College email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`you@${ALLOWED_EMAIL_DOMAINS[0]}`}
              required
              className="input-field"
              autoComplete="email"
            />
            <p className="text-white/30 text-xs mt-1">Only students with a college email can join</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              className="input-field"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              required
              className="input-field"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary w-full mt-2"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
