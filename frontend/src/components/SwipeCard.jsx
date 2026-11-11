import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'

/**
 * SwipeCard — a draggable profile card.
 *
 * Supports:
 *   - Mouse drag (desktop)
 *   - Touch drag (mobile)
 *   - CSS animation on programmatic swipe (from button or keyboard)
 *
 * Props:
 *   profile     — profile object to display
 *   onSwipe     — callback(direction: 'left' | 'right')
 *   onReport    — callback() to open the report dialog
 */
const SwipeCard = forwardRef(function SwipeCard({ profile, onSwipe, onReport }, ref) {
  const cardRef   = useRef(null)
  const [dragging, setDragging]   = useState(false)
  const [offsetX, setOffsetX]     = useState(0)
  const [animDir, setAnimDir]     = useState(null) // 'left' | 'right' | null

  const startX = useRef(0)

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const onDragStart = useCallback((clientX) => {
    setDragging(true)
    startX.current = clientX
  }, [])

  const onDragMove = useCallback((clientX) => {
    if (!dragging) return
    setOffsetX(clientX - startX.current)
  }, [dragging])

  const onDragEnd = useCallback(() => {
    if (!dragging) return
    setDragging(false)

    const threshold = 100 // px before committing to a swipe
    if (offsetX > threshold) {
      triggerSwipe('right')
    } else if (offsetX < -threshold) {
      triggerSwipe('left')
    } else {
      // Spring back
      setOffsetX(0)
    }
  }, [dragging, offsetX])

  // Mouse events
  const onMouseDown = (e) => onDragStart(e.clientX)
  const onMouseMove = (e) => { if (dragging) onDragMove(e.clientX) }
  const onMouseUp   = ()  => onDragEnd()

  // Touch events
  const onTouchStart = (e) => onDragStart(e.touches[0].clientX)
  const onTouchMove  = (e) => { if (dragging) onDragMove(e.touches[0].clientX) }
  const onTouchEnd   = ()  => onDragEnd()

  // ── Programmatic swipe (button / keyboard) ────────────────────────────────

  const triggerSwipe = (direction) => {
    if (animDir) return
    setAnimDir(direction)
    setOffsetX(0)
  }

  // lets the buttons / arrow keys play the same fly-away animation as dragging
  useImperativeHandle(ref, () => ({ swipe: triggerSwipe }))

  const handleAnimationEnd = () => {
    if (animDir) {
      onSwipe(animDir)
      setAnimDir(null)
    }
  }

  // ── Derived styles ────────────────────────────────────────────────────────

  const rotation = dragging ? offsetX * 0.08 : 0
  const likeOpacity  = Math.min(1, Math.max(0, offsetX / 80))
  const nopeOpacity  = Math.min(1, Math.max(0, -offsetX / 80))

  const cardStyle = !animDir
    ? {
        transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
        transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'pan-y',
      }
    : {}

  const animClass = animDir === 'left'  ? 'swipe-animating-left'
                  : animDir === 'right' ? 'swipe-animating-right'
                  : ''

  const interests = profile.interests || []

  return (
    <div
      ref={cardRef}
      className={`relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl select-none ${animClass}`}
      style={cardStyle}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onAnimationEnd={handleAnimationEnd}
    >
      {/* Profile photo */}
      <div className="relative h-[520px] bg-surface-50">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.name}
            className="w-full h-full object-cover pointer-events-none"
            draggable="false"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-900 to-surface-200 text-8xl">
            {profile.name?.[0] ?? '?'}
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

        {/* LIKE / NOPE indicators */}
        <div
          className="absolute top-6 left-6 border-4 border-green-400 text-green-400 rounded-xl px-4 py-1 font-extrabold text-2xl rotate-[-20deg] pointer-events-none"
          style={{ opacity: likeOpacity }}
        >
          LIKE ❤️
        </div>
        <div
          className="absolute top-6 right-6 border-4 border-primary text-primary rounded-xl px-4 py-1 font-extrabold text-2xl rotate-[20deg] pointer-events-none"
          style={{ opacity: nopeOpacity }}
        >
          NOPE ✕
        </div>

        {/* Report button */}
        <button
          onClick={(e) => { e.stopPropagation(); onReport() }}
          className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded-full w-9 h-9 flex items-center justify-center transition-all duration-200 text-base"
          title="Report this profile"
        >
          ⚑
        </button>

        {/* Profile info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-none">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white leading-tight">
                {profile.name}, <span className="font-normal">{profile.age}</span>
              </h2>
              <p className="text-white/70 text-sm mt-0.5 flex items-center gap-1">
                <span>🎓</span> {profile.college}
              </p>
            </div>
          </div>

          {profile.bio && (
            <p className="text-white/80 text-sm mt-3 line-clamp-2 leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Interest tags */}
          {interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {interests.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-white text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
});

export default SwipeCard
