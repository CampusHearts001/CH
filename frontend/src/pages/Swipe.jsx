import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import SwipeCard  from '../components/SwipeCard'
import MatchModal from '../components/MatchModal'

export default function Swipe() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [profile, setProfile]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [empty, setEmpty]           = useState(false)
  const [error, setError]           = useState('')
  const [myProfile, setMyProfile]   = useState(null)
  const [matchData, setMatchData]   = useState(null)   // { profile, matchId }
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting]   = useState(false)
  const [swiping, setSwiping]       = useState(false)  // debounce guard
  const cardRef = useRef(null)

  // Fetch the next profile to show
  const fetchNext = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/profiles/discover')
      setProfile(data)
      setEmpty(false)
    } catch (err) {
      if (err.message?.includes('No more')) {
        setEmpty(true)
        setProfile(null)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Load our own profile (for the match modal)
  useEffect(() => {
    if (!user) return
    api.get('/profiles/me').then(({ data }) => setMyProfile(data)).catch(() => {})
  }, [user])

  useEffect(() => {
    fetchNext()
  }, [fetchNext])

  // Keyboard shortcuts: ← pass, → like
  useEffect(() => {
    const handleKey = (e) => {
      if (reportOpen) return
      if (e.key === 'ArrowLeft')  cardRef.current?.swipe('left')
      if (e.key === 'ArrowRight') cardRef.current?.swipe('right')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const handleSwipe = async (direction) => {
    if (!profile || swiping) return
    setSwiping(true)

    const swiped = profile
    setProfile(null) // remove card while animating

    try {
      const { data } = await api.post('/swipes', {
        swiped_id: swiped.id,
        direction,
      })

      if (data.matched && data.match_id) {
        setMatchData({ profile: swiped, matchId: data.match_id })
      } else {
        fetchNext()
      }
    } catch (err) {
      setError(err.message)
      fetchNext()
    } finally {
      setSwiping(false)
    }
  }

  const handleReport = async () => {
    if (!profile || reporting) return
    setReporting(true)
    try {
      await api.post('/reports', {
        reported_id: profile.id,
        reason: reportReason || null,
      })
      setReportOpen(false)
      setReportReason('')
      fetchNext()
    } catch (err) {
      setError(err.message)
    } finally {
      setReporting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-start pt-6 px-4">
      {/* Title */}
      <div className="w-full max-w-sm mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span>💘</span> Discover
        </h1>
        <p className="text-white/40 text-xs">Hearts are secret until it's mutual</p>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="w-full max-w-sm rounded-3xl overflow-hidden animate-pulse">
          <div className="h-[520px] bg-surface-50" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-primary/10 border border-primary/30 text-primary-300 rounded-xl px-4 py-3 text-sm max-w-sm w-full text-center">
          {error}
          <button onClick={fetchNext} className="block mx-auto mt-2 text-primary-400 underline text-xs">
            Try again
          </button>
        </div>
      )}

      {/* No more profiles */}
      {empty && !loading && (
        <div className="text-center mt-20 animate-fade-in">
          <div className="text-6xl mb-4">😴</div>
          <h2 className="text-xl font-bold text-white mb-2">You're all caught up!</h2>
          <p className="text-white/50 text-sm">You've seen everyone for now.<br />New people join all the time — check back soon.</p>
          <button onClick={fetchNext} className="btn-secondary mt-6 text-sm">
            Refresh
          </button>
        </div>
      )}

      {/* Swipe card */}
      {profile && !loading && (
        <>
          <SwipeCard
            key={profile.id}
            ref={cardRef}
            profile={profile}
            onSwipe={handleSwipe}
            onReport={() => setReportOpen(true)}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-6 mt-6">
            <button
              onClick={() => cardRef.current?.swipe('left')}
              disabled={swiping}
              className="w-16 h-16 rounded-full bg-surface-50 border border-white/10 hover:bg-surface-100 hover:border-white/20 flex items-center justify-center text-2xl transition-all duration-200 shadow-lg disabled:opacity-50"
              title="Pass"
            >
              ✕
            </button>
            <button
              onClick={() => cardRef.current?.swipe('right')}
              disabled={swiping}
              className="w-20 h-20 rounded-full bg-primary hover:bg-primary-700 flex items-center justify-center text-3xl transition-all duration-200 shadow-lg shadow-primary/30 disabled:opacity-50"
              title="Like"
            >
              ❤️
            </button>
          </div>
        </>
      )}

      {/* Match overlay */}
      {matchData && (
        <MatchModal
          myProfile={myProfile}
          theirProfile={matchData.profile}
          onDismiss={() => {
            setMatchData(null)
            navigate('/matches')
          }}
        />
      )}

      {/* Report modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-10">
          <div className="card w-full max-w-sm p-6 animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4">Report profile</h3>
            <textarea
              className="input-field resize-none mb-4"
              rows={3}
              placeholder="Reason (optional)"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setReportOpen(false); setReportReason('') }}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={reporting}
                className="btn-primary flex-1 text-sm bg-primary"
              >
                {reporting ? 'Reporting…' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
