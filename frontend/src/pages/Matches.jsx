import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function MatchCard({ match, myId, onShareContact, onPlayGame, onUnmatch }) {
  const other    = match.other_user
  const iShared  = match.i_shared
  const theyShared = match.they_shared

  return (
    <div className="card p-4 flex flex-col gap-4 animate-fade-in">
      {/* Top row: avatar + info */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-surface-50 border border-white/10">
          {other?.avatar_url ? (
            <img src={other.avatar_url} alt={other.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
              {other?.name?.[0] ?? '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base truncate">{other?.name}</h3>
          <p className="text-white/50 text-xs truncate">🎓 {other?.college}</p>
          <p className="text-white/30 text-xs mt-0.5">Matched {timeAgo(match.created_at)}</p>
        </div>
      </div>

      {/* Contact sharing status */}
      {match.both_shared && match.other_contact && (
        <div className="bg-green-900/30 border border-green-500/30 rounded-xl px-4 py-2.5">
          <p className="text-green-400 text-xs font-semibold mb-0.5">Contact info 📱</p>
          <p className="text-white text-sm">{match.other_contact}</p>
        </div>
      )}

      {iShared && !theyShared && (
        <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-xl px-4 py-2.5">
          <p className="text-yellow-400 text-xs">⏳ Waiting for them to share back…</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {!iShared && (
          <button
            onClick={() => onShareContact(match.id)}
            className="btn-secondary flex-1 text-sm py-2.5 flex items-center justify-center gap-1.5"
          >
            Share Contact 📱
          </button>
        )}
        {iShared && theyShared && !match.other_contact && (
          <button
            onClick={() => onShareContact(match.id)}
            className="btn-secondary flex-1 text-sm py-2.5"
          >
            View Contact 📱
          </button>
        )}
        <button
          onClick={() => onPlayGame(match.id)}
          className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-1.5"
        >
          Play Game 🎮
        </button>
      </div>
      <button
        onClick={() => onUnmatch(match)}
        className="text-white/30 hover:text-primary-300 text-xs self-center transition-colors"
      >
        Unmatch
      </button>
    </div>
  )
}

export default function Matches() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Modal state for contact sharing confirmation
  const [shareModalId, setShareModalId]     = useState(null)
  const [shareResult, setShareResult]       = useState(null)
  const [sharingLoading, setSharingLoading] = useState(false)

  const fetchMatches = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/matches')
      setMatches(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMatches() }, [])

  const handleShareContact = (matchId) => {
    setShareResult(null)
    setShareModalId(matchId)
  }

  const confirmShare = async () => {
    setSharingLoading(true)
    try {
      const { data } = await api.post(`/matches/${shareModalId}/share-contact`)
      setShareResult(data)
      // Refresh the match list so the UI reflects the new state
      fetchMatches()
    } catch (err) {
      setShareResult({ error: err.message })
    } finally {
      setSharingLoading(false)
    }
  }

  const handlePlayGame = async (matchId) => {
    // The server returns the running game if there is one, otherwise starts a new one
    try {
      const { data } = await api.post('/games', { match_id: matchId })
      navigate(`/game/${data.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUnmatch = async (match) => {
    if (!window.confirm(`Unmatch with ${match.other_user?.name}? This can't be undone.`)) return
    try {
      await api.delete(`/matches/${match.id}`)
      setMatches((ms) => ms.filter((m) => m.id !== match.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-extrabold text-white mb-6 flex items-center gap-2">
        <span>💞</span> Your Matches
      </h1>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-full bg-surface-50" />
                <div className="flex-1 space-y-2 pt-2">
                  <div className="h-4 bg-surface-50 rounded w-1/2" />
                  <div className="h-3 bg-surface-50 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-6">
          <p className="text-primary-300 text-sm">{error}</p>
          <button onClick={fetchMatches} className="btn-ghost mt-3 text-sm">Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && matches.length === 0 && (
        <div className="text-center mt-20 animate-fade-in">
          <div className="text-6xl mb-4">👀</div>
          <h2 className="text-xl font-bold text-white mb-2">No matches yet</h2>
          <p className="text-white/50 text-sm">Start swiping to find your match!</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-6">
            Start Discovering 💘
          </button>
        </div>
      )}

      {/* Match grid */}
      {!loading && matches.length > 0 && (
        <div className="space-y-4">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              myId={user?.id}
              onShareContact={handleShareContact}
              onPlayGame={handlePlayGame}
              onUnmatch={handleUnmatch}
            />
          ))}
        </div>
      )}

      {/* Share contact confirmation modal */}
      {shareModalId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-10">
          <div className="card w-full max-w-sm p-6 animate-fade-in">
            {!shareResult ? (
              <>
                <h3 className="text-lg font-bold text-white mb-2">Share your contact info?</h3>
                <p className="text-white/60 text-sm mb-6">
                  Your contact info will be shared with this match. They will only see it if they share theirs with you too.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShareModalId(null)}
                    className="btn-secondary flex-1 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmShare}
                    disabled={sharingLoading}
                    className="btn-primary flex-1 text-sm"
                  >
                    {sharingLoading ? 'Sharing…' : 'Yes, share it 📱'}
                  </button>
                </div>
              </>
            ) : shareResult.error ? (
              <>
                <p className="text-primary-300 text-sm mb-4">{shareResult.error}</p>
                <button onClick={() => setShareModalId(null)} className="btn-secondary w-full text-sm">Close</button>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">{shareResult.both_shared ? '🎉' : '⏳'}</div>
                  <h3 className="text-lg font-bold text-white mb-1">{shareResult.message}</h3>
                  {shareResult.both_shared && shareResult.other_contact && (
                    <div className="mt-3 bg-green-900/30 border border-green-500/30 rounded-xl px-4 py-3">
                      <p className="text-green-400 text-xs font-semibold mb-1">Their contact</p>
                      <p className="text-white">{shareResult.other_contact}</p>
                    </div>
                  )}
                </div>
                <button onClick={() => setShareModalId(null)} className="btn-secondary w-full text-sm">Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
