/**
 * GameBoard — 6×5 Wordle-style grid.
 *
 * Props:
 *   guesses      — array of guess objects { guess, results: [{letter, result}] }
 *   currentInput — string being typed for the active row (before submit)
 *   maxGuesses   — number of rows (default 6)
 *   wordLength   — number of columns (default 5)
 */
export default function GameBoard({ guesses = [], currentInput = '', maxGuesses = 6, wordLength = 5 }) {
  const rows = []

  for (let r = 0; r < maxGuesses; r++) {
    const isSubmitted  = r < guesses.length
    const isCurrentRow = r === guesses.length && r < maxGuesses
    const cells = []

    for (let c = 0; c < wordLength; c++) {
      let letter = ''
      let cellClass = 'wordle-cell wordle-cell-empty'

      if (isSubmitted) {
        const g = guesses[r]
        const lr = g.results[c]
        letter    = lr.letter.toUpperCase()
        cellClass = `wordle-cell wordle-cell-${lr.result}`
      } else if (isCurrentRow) {
        letter    = (currentInput[c] || '').toUpperCase()
        cellClass = `wordle-cell ${letter ? 'wordle-cell-filled' : 'wordle-cell-empty'}`
      }

      cells.push(
        <div key={c} className={cellClass}>
          {letter}
        </div>
      )
    }

    rows.push(
      <div key={r} className="flex gap-1.5 sm:gap-2">
        {cells}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 items-center">
      {rows}
    </div>
  )
}
