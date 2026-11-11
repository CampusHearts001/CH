import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import GameBoard from '../components/GameBoard'
import Keyboard  from '../components/Keyboard'

/**
 * Compute the best-known state of each letter key across all guesses.
 * Priority: green > yellow > grey
 */
function buildLetterStates(guesses) {
  const priority = { green: 3, yellow: 2, grey: 1 }
  const states = {}
  for (const g of guesses) {
    for (const lr of g.results) {
      const l = lr.letter.toUpperCase()
      const existing = states[l]
      if (!existing || priority[lr.result] > priority[existing]) {
        states[l] = lr.result
      }
    }
  }
  return states
}

export default function Game() {
  const { gameId } = useParams()
  const { user }   = useAuth()
  const navigate   = useNavigate()

  const [game, setGame]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [input, setInput]         = useState('')          // current row input
  const [submitting, setSubmitting] = useState(false)
  const [flashError, setFlashError] = useState('')        // inline guess error

  const fetchGame = useCallback(async () => {
    try {
      const { data } = await api.get(`/games/${gameId}`)
      setGame(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => { fetchGame() }, [fetchGame])

  // While waiting for the other player, check for their move every 3 seconds
  useEffect(() => {
    if (!game || game.status !== 'active' || game.is_my_turn) return
    const t = setInterval(fetchGame, 3000)
    return () => clearInterval(t)
  }, [game, fetchGame])

  const playAgain = async () => {
    try {
      const { data } = await api.post('/games', { match_id: game.match_id })
      setInput('')
      navigate(`/game/${data.id}`)
    } catch (err) {
      setFlashError(err.message)
    }
  }

  // Physical keyboard handler
  useEffect(() => {
    if (!game || game.status !== 'active' || !game.is_my_turn) return
    const handleKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Enter')     handleSubmitGuess()
      else if (e.key === 'Backspace') setInput((p) => p.slice(0, -1))
      else if (/^[a-zA-Z]$/.test(e.key) && input.length < 5) {
        setInput((p) => p + e.key.toUpperCase())
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const handleKey = (key) => {
    if (!game || game.status !== 'active' || !game.is_my_turn) return
    setFlashError('')
    if (key === 'ENTER')     { handleSubmitGuess(); return }
    if (key === 'BACKSPACE') { setInput((p) => p.slice(0, -1)); return }
    if (input.length < 5)   { setInput((p) => p + key) }
  }

  const handleSubmitGuess = async () => {
    if (submitting) return
    if (input.length !== 5) {
      setFlashError('Word must be 5 letters.')
      return
    }
    setSubmitting(true)
    setFlashError('')
    try {
      await api.post(`/games/${gameId}/guess`, { guess: input.toLowerCase() })
      setInput('')
      fetchGame() // refresh full state
    } catch (err) {
      setFlashError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="text-primary-300 mb-4">{error}</p>
        <button onClick={() => navigate('/matches')} className="btn-secondary">Back to Matches</button>
      </div>
    )
  }

  const isMyTurn    = game.is_my_turn
  const isOver      = game.status !== 'active'
  const iWon        = isOver && game.winner === user?.id
  const theyWon     = isOver && game.winner && game.winner !== user?.id
  const isLost      = isOver && game.status === 'lost'
  const letterStates = buildLetterStates(game.guesses)
  const guessesLeft  = game.max_guesses - game.guesses.length

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-6 flex flex-col items-center gap-6">
      {/* Header */}
      <div className="w-full flex items-center gap-3">
        <button onClick={() => navigate('/matches')} className="text-white/50 hover:text-white p-2 -ml-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <span>🎮</span> Word Game
        </h1>
        <span className="ml-auto text-white/40 text-xs">{guessesLeft} guesses left</span>
      </div>

      {/* Status banner */}
      {!isOver && (
        <div className={`w-full text-center py-2.5 rounded-xl text-sm font-semibold ${
          isMyTurn
            ? 'bg-primary/20 border border-primary/30 text-primary-300'
            : 'bg-surface-50 border border-white/10 text-white/60'
        }`}>
          {isMyTurn ? '🟢 Your turn — make a guess!' : "⏳ Waiting for your match's guess…"}
        </div>
      )}

      {/* Game over banner */}
      {isOver && (
        <div className={`w-full text-center py-4 rounded-2xl ${
          iWon ? 'bg-green-900/40 border border-green-500/30' :
          theyWon ? 'bg-yellow-900/30 border border-yellow-500/30' :
          'bg-surface-50 border border-white/10'
        }`}>
          <p className="text-2xl mb-1">{iWon ? '🏆' : theyWon ? '😅' : '😔'}</p>
          <p className="font-bold text-white text-base">
            {iWon ? 'You won!' : theyWon ? 'They got it first!' : 'Game over!'}
          </p>
          {game.word && (
            <p className="text-white/60 text-sm mt-1">
              The word was <span className="text-white font-semibold uppercase">{game.word}</span>
            </p>
          )}
        </div>
      )}

      {/* Board */}
      <GameBoard
        guesses={game.guesses}
        currentInput={isMyTurn && !isOver ? input : ''}
        maxGuesses={game.max_guesses}
        wordLength={5}
      />

      {/* Flash error */}
      {flashError && (
        <p className="text-primary-300 text-sm font-medium animate-fade-in">{flashError}</p>
      )}

      {/* Keyboard — only shown on your turn */}
      {!isOver && isMyTurn && (
        <div className="w-full">
          <Keyboard
            letterStates={letterStates}
            onKey={handleKey}
            disabled={submitting}
          />
          <button
            onClick={handleSubmitGuess}
            disabled={submitting || input.length !== 5}
            className="btn-primary w-full mt-4"
          >
            {submitting ? 'Checking…' : 'Submit guess →'}
          </button>
        </div>
      )}

      {/* Play again after game ends */}
      {isOver && (
        <div className="w-full flex gap-3">
          <button onClick={() => navigate('/matches')} className="btn-secondary flex-1">
            Back
          </button>
          <button onClick={playAgain} className="btn-primary flex-1">
            Play again 🎮
          </button>
        </div>
      )}
    </div>
  )
}
