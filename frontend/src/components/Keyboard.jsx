/**
 * Keyboard — on-screen QWERTY keyboard for the word game.
 *
 * Props:
 *   letterStates — Map<letter, 'green'|'yellow'|'grey'|undefined>
 *   onKey        — callback(key: string) where key is 'A'-'Z', 'ENTER', or 'BACKSPACE'
 *   disabled     — bool
 */

const ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
]

export default function Keyboard({ letterStates = {}, onKey, disabled = false }) {
  const getKeyClass = (key) => {
    if (key === 'ENTER' || key === '⌫') {
      return 'key-btn key-default text-xs sm:text-sm flex-1 max-w-[4rem]'
    }

    const state = letterStates[key]
    const colorClass =
      state === 'green'  ? 'key-green'  :
      state === 'yellow' ? 'key-yellow' :
      state === 'grey'   ? 'key-grey'   :
                           'key-default'

    return `key-btn ${colorClass}`
  }

  const handleClick = (key) => {
    if (disabled) return
    // Map the backspace symbol to the standard string
    onKey(key === '⌫' ? 'BACKSPACE' : key)
  }

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-sm mx-auto select-none">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1 justify-center">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => handleClick(key)}
              disabled={disabled}
              className={getKeyClass(key)}
              aria-label={key}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
