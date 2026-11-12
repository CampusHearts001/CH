import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

export default function Subscription() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshStatus = useCallback(async () => {
    const { data } = await api.get('/payments/status')
    setStatus(data)
    if (data.active) navigate('/', { replace: true })
    return data
  }, [navigate])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        await api.get('/profiles/me')
      } catch (err) {
        if (!alive) return
        const code = err.response?.status
        if (code === 404 || err.message?.toLowerCase().includes('profile not found')) {
          navigate('/setup', { replace: true })
        } else {
          setError(err.response?.data?.detail || err.message || 'Could not load your profile.')
        }
        setLoading(false)
        return
      }
      try {
        const { data } = await api.get('/payments/status')
        if (!alive) return
        setStatus(data)
        if (data.active) navigate('/', { replace: true })
      } catch (err) {
        if (alive) setError(err.response?.data?.detail || err.message || 'Could not verify membership.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [navigate])

  const startPayment = async () => {
    setError('')
    setNotice('')
    setPaying(true)
    try {
      const { data } = await api.post('/payments/order/create')
      const url = new URL(data.payment_url)
      if (url.protocol !== 'https:' || url.origin !== 'https://upi-gateway-production-91514c2e.up.railway.app') {
        throw new Error('Unexpected checkout address. Payment was not opened.')
      }
      setNotice('Open checkout to pay, then return to check approval. Do not pay twice.')
      // Navigation is deliberate: the user can return using the browser Back button.
      window.location.assign(url.href)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to start payment.')
    } finally {
      setPaying(false)
    }
  }

  const checkMembership = async () => {
    setChecking(true)
    setError('')
    try {
      const latest = await refreshStatus()
      if (!latest.active) setNotice('Your membership is not active yet. Payment must be verified against the bank transaction and approved by the administrator.')
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not check membership.')
    } finally {
      setChecking(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface-400"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" /></div>
  }

  return (
    <div className="min-h-screen bg-surface-400 flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-7">
        <div className="text-center mb-7">
          <div className="text-5xl mb-3">💘</div>
          <h1 className="text-2xl font-extrabold text-white">CampusMatch</h1>
          <p className="text-white/50 text-sm mt-2">A little closer to your campus connection.</p>
        </div>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm p-3 mb-4">{error}</div>}
        {notice && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm p-3 mb-4">{notice}</div>}

        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center">
          <p className="text-white/60 text-sm">CampusMatch 7-day membership</p>
          <div className="my-2"><span className="text-4xl font-extrabold text-white">₹129</span><span className="text-white/50"> / 7 days</span></div>
          <p className="text-white/50 text-xs">One-time payment. No automatic renewal.</p>
        </div>

        <ul className="text-white/70 text-sm space-y-2 my-6">
          <li>✓ Full CampusMatch access for 7 days after approval</li>
          <li>✓ Pay through our UPI Gateway</li>
          <li>✓ Payment verified against bank records before activation</li>
          <li>✓ Renew manually when your access expires</li>
        </ul>

        {status?.status === 'pending' && (
          <p className="text-amber-200 text-xs text-center mb-4">A payment order is pending. Do not pay twice if you have already completed a transfer.</p>
        )}

        <button className="btn-primary w-full" onClick={startPayment} disabled={paying || checking}>
          {paying ? 'Opening payment page…' : status?.status === 'pending' ? 'Resume existing payment' : 'Pay ₹129 with UPI'}
        </button>

        <button className="w-full text-sm text-white/80 hover:text-white mt-5" onClick={checkMembership} disabled={checking || paying}>
          {checking ? 'Checking membership…' : 'I have paid — check membership status'}
        </button>

        {status?.current_period_end && (
          <p className="text-white/40 text-xs text-center mt-3">Previous access end: {new Date(status.current_period_end).toLocaleString()}</p>
        )}

        <button className="w-full text-sm text-white/40 hover:text-white mt-5" onClick={signOut}>Sign out</button>
        <p className="text-[11px] leading-5 text-white/30 text-center mt-5">Payment submission does not automatically activate membership. Access begins after independent bank verification and administrator approval. Never share your UPI PIN or OTP.</p>
      </div>
    </div>
  )
}
