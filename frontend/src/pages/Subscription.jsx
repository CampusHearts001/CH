import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true)
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true })
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay Checkout.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = CHECKOUT_SCRIPT
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout.'))
    document.body.appendChild(script)
  })
}

export default function Subscription() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshStatus = useCallback(async () => {
    const { data } = await api.get('/payments/status')
    setStatus(data)
    return data
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        await api.get('/profiles/me')
        const { data } = await api.get('/payments/status')
        if (!alive) return
        setStatus(data)
        if (data.active) navigate('/', { replace: true })
      } catch (err) {
        if (!alive) return
        if (err.message?.toLowerCase().includes('profile not found') || err.message?.includes('404')) {
          navigate('/setup', { replace: true })
        } else setError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [navigate])

  const startSubscription = async () => {
    setError('')
    setNotice('')
    setPaying(true)
    try {
      await loadRazorpay()
      const { data } = await api.post('/payments/subscription/create')
      const checkout = new window.Razorpay({
        key: data.key_id,
        subscription_id: data.subscription_id,
        name: data.name,
        description: data.description,
        prefill: { email: user?.email || '' },
        theme: { color: '#ec4899' },
        handler: async (response) => {
          try {
            const verification = await api.post('/payments/subscription/verify', {
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            if (verification.data.active) {
              await refreshStatus()
              navigate('/', { replace: true })
              return
            }
            setNotice('Payment signature verified. We are waiting for Razorpay to confirm the captured payment. This page will update shortly.')
            for (let attempt = 0; attempt < 8; attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, 2000))
              const latest = await refreshStatus()
              if (latest.active) { navigate('/', { replace: true }); return }
            }
          } catch (err) {
            setError(err.message || 'Payment verification could not be completed.')
          } finally {
            setPaying(false)
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      })
      checkout.on('payment.failed', (response) => {
        setError(response.error?.description || 'Payment failed. Please try again.')
        setPaying(false)
      })
      checkout.open()
    } catch (err) {
      setError(err.message || 'Unable to start the subscription.')
      setPaying(false)
    }
  }

  const cancelRenewal = async () => {
    if (!window.confirm('Cancel automatic renewal? Your paid access will remain until the current period ends.')) return
    setCancelling(true)
    setError('')
    try {
      const { data } = await api.post('/payments/subscription/cancel')
      setNotice(data.message)
      await refreshStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setCancelling(false)
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
        {notice && <div className="rounded-xl border border-green-500/30 bg-green-500/10 text-green-300 text-sm p-3 mb-4">{notice}</div>}

        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center">
          <p className="text-white/60 text-sm">CampusMatch weekly membership</p>
          <div className="my-2"><span className="text-4xl font-extrabold text-white">₹129</span><span className="text-white/50"> / week</span></div>
          <p className="text-white/50 text-xs">₹129 charged now, then ₹129 automatically every 7 days.</p>
        </div>

        <ul className="text-white/70 text-sm space-y-2 my-6">
          <li>✓ Full access to CampusMatch after successful payment</li>
          <li>✓ UPI AutoPay mandate authorization through Razorpay</li>
          <li>✓ Automatic weekly renewal until you cancel</li>
          <li>✓ Cancel renewal; access continues through the paid period</li>
        </ul>

        <button className="btn-primary w-full" onClick={startSubscription} disabled={paying || status?.cancel_at_period_end}>
          {paying ? 'Opening secure checkout…' : 'Subscribe with Razorpay · ₹129'}
        </button>
        {status?.cancel_at_period_end && <p className="text-amber-300 text-xs text-center mt-3">Automatic renewal is scheduled to stop. You can continue using CampusMatch until your paid period ends.</p>}
        {status?.current_period_end && <p className="text-white/40 text-xs text-center mt-3">Last paid period ended: {new Date(status.current_period_end).toLocaleString()}</p>}
        {status?.active && !status?.cancel_at_period_end && (
          <button className="w-full text-sm text-white/50 hover:text-red-300 mt-4" onClick={cancelRenewal} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel automatic renewal'}
          </button>
        )}
        <button className="w-full text-sm text-white/40 hover:text-white mt-5" onClick={signOut}>Sign out</button>
        <p className="text-[11px] leading-5 text-white/30 text-center mt-5">By subscribing, you authorize recurring UPI AutoPay debits of ₹129 every 7 days. Your bank or UPI app may show the mandate terms before you approve. Payments are processed by Razorpay.</p>
      </div>
    </div>
  )
}
