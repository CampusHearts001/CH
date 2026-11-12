import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const formatDate = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export default function AdminPayments() {
  const { user, signOut } = useAuth()
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [denied, setDenied] = useState(false)
  const [selected, setSelected] = useState(null)
  const [bankRef, setBankRef] = useState('')
  const [bankConfirmed, setBankConfirmed] = useState(false)
  const [reason, setReason] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // This endpoint enforces PAYMENT_ADMIN_USER_ID on the server.
      const [pendingResult, historyResult] = await Promise.all([
        api.get('/payments/admin/pending'),
        api.get('/payments/admin/history'),
      ])
      setPending(pendingResult.data?.orders || [])
      setHistory(historyResult.data?.reviews || [])
      setDenied(false)
    } catch (err) {
      const message = err.message || 'Unable to load payment data.'
      if (/admin access required|403|forbidden/i.test(message)) setDenied(true)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function openReview(order, action) {
    setSelected({ ...order, action })
    setBankRef('')
    setBankConfirmed(false)
    setReason('')
    setError('')
    setNotice('')
  }

  async function submitReview(event) {
    event.preventDefault()
    if (!selected || busy) return
    if (selected.action === 'approve' && (!bankConfirmed || bankRef.trim().length < 6)) return
    if (selected.action === 'reject' && reason.trim().length < 5) return
    setBusy(true)
    setError('')
    try {
      const payload = {
        user_id: selected.user_id,
        gateway_order_id: selected.gateway_order_id,
      }
      if (selected.action === 'approve') {
        await api.post('/payments/admin/approve', {
          ...payload,
          bank_transaction_ref: bankRef.trim(),
          bank_payment_confirmed: true,
        })
      } else {
        await api.post('/payments/admin/reject', { ...payload, reason: reason.trim() })
      }
      setNotice(`Order ${selected.gateway_order_id} ${selected.action === 'approve' ? 'approved' : 'rejected'}.`)
      setSelected(null)
      await refresh()
    } catch (err) {
      setError(err.message || 'Review failed.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-pink-500'
  const btnClass = 'rounded-xl px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <main className="min-h-screen bg-[#0d0d17] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-semibold tracking-widest text-pink-400">CAMPUSMATCH</p>
            <h1 className="text-3xl font-bold">Payment Admin</h1>
            <p className="mt-2 text-sm text-white/50">Signed in as {user?.email || 'Admin'}</p>
          </div>
          <div className="flex gap-2">
            <button className={`${btnClass} bg-white/10 hover:bg-white/20`} onClick={refresh} disabled={loading || busy}>Refresh</button>
            <button className={`${btnClass} bg-white/10 hover:bg-white/20`} onClick={signOut}>Sign out</button>
          </div>
        </header>

        {denied ? (
          <section className="rounded-2xl border border-red-400/30 bg-red-400/10 p-8 text-center">
            <h2 className="text-xl font-bold">Access denied</h2>
            <p className="mt-2 text-white/70">This account is not authorized to manage payments.</p>
            <Link to="/" className="mt-5 inline-block text-pink-400 underline">Return to CampusMatch</Link>
          </section>
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              {[
                ['Pending orders', pending.length],
                ['Approved reviews', history.filter((x) => x.decision === 'approved').length],
                ['Rejected reviews', history.filter((x) => x.decision === 'rejected').length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/55">{label}</p>
                  <p className="mt-2 text-3xl font-bold">{loading ? '…' : value}</p>
                </div>
              ))}
            </div>
            <p className="mb-5 text-xs text-white/40">Counts reflect up to the latest 100 records returned by each API, not lifetime totals.</p>

            <div className="mb-6 flex gap-2 border-b border-white/10 pb-3">
              {['pending', 'history'].map((name) => (
                <button key={name} onClick={() => setTab(name)} className={`${btnClass} ${tab === name ? 'bg-pink-600' : 'bg-white/5 hover:bg-white/10'}`}>
                  {name === 'pending' ? 'Pending payments' : 'Review history'}
                </button>
              ))}
            </div>

            {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
            {notice && <div role="status" className="mb-5 rounded-xl border border-green-400/30 bg-green-400/10 p-4 text-sm text-green-200">{notice}</div>}
            {loading ? <p className="py-12 text-center text-white/60">Loading payments…</p> : tab === 'pending' ? (
              pending.length === 0 ? <p className="rounded-2xl bg-white/5 p-10 text-center text-white/60">No pending orders.</p> : (
                <div className="space-y-4">
                  {pending.map((order) => (
                    <article key={order.gateway_order_id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2 text-sm">
                          <p className="font-semibold text-lg">₹129 <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-300">Pending</span></p>
                          <p className="break-all text-white/75">Order: {order.gateway_order_id}</p>
                          <div className="flex items-center gap-3 py-2">
                            {order.avatar_url ? (
                              <img src={order.avatar_url} alt="Student profile" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-600 font-bold text-white">
                                {order.student_name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-white">{order.student_name || 'Unknown Student'}</p>
                              <p className="text-sm text-white/50">{order.college || 'College not provided'}</p>
                              <p className="break-all text-xs text-white/40">ID: {order.user_id}</p>
                            </div>
                          </div>
                          <p className="text-white/50">Updated: {formatDate(order.updated_at)}</p>
                          <div className="space-y-1 rounded-xl border border-white/10 bg-black/20 p-3">
                            <p className="text-white/70">Gateway status: <span className="font-semibold text-white">{order.gateway_lookup_error ? 'Unavailable' : (order.gateway_status || 'Unknown')}</span></p>
                            {order.gateway_lookup_error ? (
                              <p className="text-amber-200/80">Could not retrieve gateway details. Refresh to retry; check the gateway directly.</p>
                            ) : order.submitted_utr ? (
                              <>
                                <p className="break-all text-white/80">Submitted UTR: <span className="font-semibold text-pink-300">{order.submitted_utr}</span></p>
                                <p className="text-xs text-amber-200/80">Student-submitted reference only — verify the actual ₹129 bank credit independently.</p>
                              </>
                            ) : (
                              <p className="text-amber-200/80">Submitted UTR: Not submitted (or not available for this gateway status).</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openReview(order, 'approve')} className={`${btnClass} bg-green-600 hover:bg-green-500`}>Approve</button>
                          <button onClick={() => openReview(order, 'reject')} className={`${btnClass} bg-red-600 hover:bg-red-500`}>Reject</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )
            ) : history.length === 0 ? <p className="rounded-2xl bg-white/5 p-10 text-center text-white/60">No reviews recorded yet.</p> : (
              <div className="space-y-3">
                {history.map((review) => (
                  <article key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
                    <div className="mb-3 flex flex-wrap justify-between gap-2">
                      <strong className="break-all">{review.gateway_order_id}</strong>
                      <span className={review.decision === 'approved' ? 'text-green-400' : 'text-red-400'}>{review.decision?.toUpperCase()}</span>
                    </div>
                    <p className="break-all text-white/60">User: {review.user_id}</p>
                    <p className="text-white/60">Reviewed: {formatDate(review.reviewed_at)}</p>
                    {review.reason && <p className="mt-2 text-white/80">Reason: {review.reason}</p>}
                    {review.bank_transaction_ref && <p className="mt-2 break-all text-white/60">Bank ref: {review.bank_transaction_ref}</p>}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selected && !denied && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="presentation">
          <form onSubmit={submitReview} role="dialog" aria-modal="true" aria-label="Review payment" className="w-full max-w-lg space-y-4 rounded-2xl border border-white/15 bg-[#191926] p-6 shadow-2xl">
            <h2 className="text-xl font-bold">{selected.action === 'approve' ? 'Approve payment' : 'Reject payment'}</h2>
            <p className="break-all text-sm text-white/60">Order: {selected.gateway_order_id}</p>
            {selected.action === 'approve' ? (
              <>
                <p className="text-sm text-amber-200">Only approve after independently verifying the ₹129 credit in your receiving bank account. A submitted UTR or gateway status is not proof of payment.</p>
                <label className="block space-y-2 text-sm"><span>Verified bank transaction reference</span><input className={inputClass} value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="Reference from bank statement" required minLength={6} /></label>
                <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-pink-500" checked={bankConfirmed} onChange={(e) => setBankConfirmed(e.target.checked)} /><span>I independently verified the ₹129 credit and matching reference in the receiving bank account.</span></label>
              </>
            ) : (
              <>
                <p className="text-sm text-amber-200">Check your bank records before rejecting. If a credit exists or is still settling, investigate instead of rejecting.</p>
                <label className="block space-y-2 text-sm"><span>Rejection reason</span><textarea className={inputClass} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this order being rejected?" required minLength={5} /></label>
              </>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" disabled={busy} onClick={() => setSelected(null)} className={`${btnClass} bg-white/10`}>Cancel</button>
              <button type="submit" disabled={busy || (selected.action === 'approve' ? !bankConfirmed || bankRef.trim().length < 6 : reason.trim().length < 5)} className={`${btnClass} ${selected.action === 'approve' ? 'bg-green-600' : 'bg-red-600'}`}>
                {busy ? 'Saving…' : selected.action === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
