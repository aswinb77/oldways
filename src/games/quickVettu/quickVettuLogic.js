// Quick Vettu (3x3 Fast Match) Logic
export const QUICK_LINES = [
  // Rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // Columns
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // Diagonals
  [0, 4, 8],
  [2, 4, 6],
]

export function checkQuickWinner(board) {
  for (let i = 0; i < QUICK_LINES.length; i++) {
    const [a, b, c] = QUICK_LINES[i]
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c], lineIdx: i }
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'tie', line: null }
  }
  return null
}

export function getQuickAiMove(board, difficulty = 'insane') {
  const emptyIndices = board
    .map((val, idx) => (val === null ? idx : null))
    .filter((v) => v !== null)

  if (emptyIndices.length === 0) return null

  if (difficulty === 'casual' && Math.random() > 0.4) {
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)]
  }

  // 1. Can AI (1) win immediately?
  for (const idx of emptyIndices) {
    const copy = [...board]
    copy[idx] = 1
    const res = checkQuickWinner(copy)
    if (res && res.winner === 1) return idx
  }

  // 2. Must AI block human (0)?
  for (const idx of emptyIndices) {
    const copy = [...board]
    copy[idx] = 0
    const res = checkQuickWinner(copy)
    if (res && res.winner === 0) return idx
  }

  // 3. Prefer center
  if (board[4] === null) return 4

  // 4. Prefer corners
  const corners = [0, 2, 6, 8].filter((c) => board[c] === null)
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)]
  }

  return emptyIndices[0]
}
