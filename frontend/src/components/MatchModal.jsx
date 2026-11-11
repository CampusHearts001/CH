import { useEffect } from 'react'
import { Link } from 'react-router-dom'

/**
 * Full-screen "It's a Match!" overlay shown when two users swipe right on each other.
 * Auto-dismisses after 2.5 s and navigates to /matches.
 */
export default function MatchModal({ myProfile, theirProfile, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={onDismiss}
    >
      {/* Gradient glow */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/30 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {/* Avatars */}
        <div className="flex items-center justify-center mb-6 -space-x-4">
          <div className="w-28 h-28 rounded-full border-4 border-primary overflow-hidden shadow-2xl shadow-primary/40 animate-bounce-in">
            {myProfile?.avatar_url ? (
              <img src={myProfile.avatar_url} alt="You" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/30 flex items-center justify-center text-5xl">
                {myProfile?.name?.[0] ?? '?'}
              </div>
            )}
          </div>

          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl z-10 border-2 border-surface-400 animate-pulse-heart shadow-lg shadow-primary/50">
            💘
          </div>

          <div className="w-28 h-28 rounded-full border-4 border-primary overflow-hidden shadow-2xl shadow-primary/40 animate-bounce-in" style={{ animationDelay: '0.1s' }}>
            {theirProfile?.avatar_url ? (
              <img src={theirProfile.avatar_url} alt={theirProfile.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/30 flex items-center justify-center text-5xl">
                {theirProfile?.name?.[0] ?? '?'}
              </div>
            )}
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-300 to-primary-500 mb-2 animate-bounce-in">
          It's a Match!
        </h1>
        <p className="text-white/70 text-lg mb-2 animate-fade-in">
          You and <span className="text-white font-semibold">{theirProfile?.name}</span> liked each other 🎉
        </p>
        <p className="text-white/40 text-sm animate-fade-in">
          Tap anywhere to continue
        </p>

        {/* CTA */}
        <Link
          to="/matches"
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          className="mt-8 btn-primary text-base px-10 animate-fade-in"
        >
          View Matches
        </Link>
      </div>
    </div>
  )
}
