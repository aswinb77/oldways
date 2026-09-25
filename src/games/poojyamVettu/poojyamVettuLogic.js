// Poojyam Vettu Core Game Logic and Rules (55-Dot Triangular Grid)
export const N = 10
export const TOTAL_DOTS = (N * (N + 1)) / 2 // 55

// Grid spacing constants for SVG projection
export const S = 42
export const M = 28

export const pos = (r, c) => [M + c * S, M + r * S]

// Generate all 27 legitimate lines in the right-angled triangle grid:
// 1. Horizontal Rows (r = 1..9): 9 lines of lengths 2..10
// 2. Vertical Columns (c = 0..8): 9 lines of lengths 10..2
// 3. Diagonals (\ parallel to hypotenuse): 9 lines of lengths 10..2
export function generateAllLines() {
  const lines = []

  // 1. Horizontal Rows (r = 1..9): dots from [r, 0] to [r, r]
  for (let r = 1; r < N; r++) {
    const dots = []
    for (let c = 0; c <= r; c++) dots.push([r, c])
    lines.push({ id: `h_${r}`, type: 'horizontal', dots, length: dots.length })
  }

  // 2. Vertical Columns (c = 0..8): dots from [c, c] to [9, c]
  for (let c = 0; c < N - 1; c++) {
    const dots = []
    for (let r = c; r < N; r++) dots.push([r, c])
    lines.push({ id: `v_${c}`, type: 'vertical', dots, length: dots.length })
  }

  // 3. Diagonals (\ top-left to bottom-right, parallel to hypotenuse): d = 0..8
  for (let d = 0; d < N - 1; d++) {
    const dots = []
    for (let i = 0; d + i < N; i++) dots.push([d + i, i])
    lines.push({ id: `d_${d}`, type: 'diagonal', dots, length: dots.length })
  }

  return lines
}

export const ALL_LINES = generateAllLines()

// Initial empty triangular grid: 10 rows, row r has r+1 elements
export function createEmptyGrid() {
  return Array.from({ length: N }, (_, r) => Array(r + 1).fill(null))
}

// Compute line endpoints extended slightly past boundary dots for dramatic cut slashes
export function getExtendedLine(dots) {
  const [r1, c1] = dots[0]
  const [r2, c2] = dots[dots.length - 1]
  const [x1, y1] = pos(r1, c1)
  const [x2, y2] = pos(r2, c2)
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len === 0) return { x1, y1, x2, y2 }
  const ext = 18
  return {
    x1: x1 - (dx / len) * ext,
    y1: y1 - (dy / len) * ext,
    x2: x2 + (dx / len) * ext,
    y2: y2 + (dy / len) * ext,
  }
}

// Check newly completed lines when a dot [r, c] is played
export function checkNewCuts(grid, completedLineSet, r, c, player) {
  const newCuts = []
  let pointsEarned = 0

  ALL_LINES.forEach((lObj, lIdx) => {
    if (completedLineSet.has(lIdx)) return
    const onLine = lObj.dots.some(([lr, lc]) => lr === r && lc === c)
    if (!onLine) return

    const isComplete = lObj.dots.every(([lr, lc]) => grid[lr][lc] !== null)
    if (isComplete) {
      const ext = getExtendedLine(lObj.dots)
      const points = lObj.dots.length * 10
      pointsEarned += points
      newCuts.push({
        lineIdx: lIdx,
        id: lObj.id,
        type: lObj.type,
        dots: lObj.dots,
        player,
        points,
        ...ext,
      })
    }
  })

  return { newCuts, pointsEarned }
}

// AI Engine
export function getAiMove(grid, completedLineSet, difficulty = 'insane', lastHumanMove = null) {
  const available = []
  for (let r = 0; r < N; r++) {
    for (let c = 0; c <= r; c++) {
      if (grid[r][c] === null) available.push([r, c])
    }
  }
  if (available.length === 0) return null

  // Casual Mode: occasional mistakes, prefers immediate score if obvious
  if (difficulty === 'casual') {
    // 50% chance to take immediate cut, 50% random
    if (Math.random() > 0.4) {
      for (const [r, c] of available) {
        for (let lIdx = 0; lIdx < ALL_LINES.length; lIdx++) {
          if (completedLineSet.has(lIdx)) continue
          const lObj = ALL_LINES[lIdx]
          if (!lObj.dots.some(([lr, lc]) => lr === r && lc === c)) continue
          const isFull = lObj.dots.every(([lr, lc]) => (lr === r && lc === c ? true : grid[lr][lc] !== null))
          if (isFull) return [r, c]
        }
      }
    }
    return available[Math.floor(Math.random() * available.length)]
  }

  // Tactical & Insane Mode:
  // 1. Immediate Score Check: Claim any line that completes on this turn (Weighted by 10 pts per dot)
  let bestScore = -1
  let scoringMoves = []

  for (const [r, c] of available) {
    let points = 0
    ALL_LINES.forEach((lObj, lIdx) => {
      if (completedLineSet.has(lIdx)) return
      if (!lObj.dots.some(([lr, lc]) => lr === r && lc === c)) return
      const isFull = lObj.dots.every(([lr, lc]) => (lr === r && lc === c ? true : grid[lr][lc] !== null))
      if (isFull) {
        points += lObj.dots.length * 10
      }
    })

    if (points > bestScore) {
      bestScore = points
      scoringMoves = [{ move: [r, c], score: points }]
    } else if (points === bestScore && points > 0) {
      scoringMoves.push({ move: [r, c], score: points })
    }
  }

  if (bestScore > 0) {
    scoringMoves.sort((a, b) => b.score - a.score)
    return scoringMoves[0].move
  }

  // 2. Evaluated Candidate Moves (Avoid blunders: NEVER leave any line at 1 dot remaining)
  const evaluated = []

  for (const [r, c] of available) {
    let blundersGiven = 0 // lines that would be left with 1 dot remaining (free gift to opponent)
    let pointsSurrendered = 0
    let safeLinesCount = 0
    let strategicScore = 0

    ALL_LINES.forEach((lObj, lIdx) => {
      if (completedLineSet.has(lIdx)) return
      const onLine = lObj.dots.some(([lr, lc]) => lr === r && lc === c)
      if (!onLine) return

      const remainingBefore = lObj.dots.filter(([lr, lc]) => grid[lr][lc] === null).length
      const remainingAfter = remainingBefore - 1

      if (remainingAfter === 1) {
        blundersGiven++
        pointsSurrendered += lObj.dots.length * 10
      } else if (remainingAfter >= 2) {
        safeLinesCount++
        strategicScore += lObj.dots.length * 4
      }

      if (lastHumanMove && lObj.dots.some(([lr, lc]) => lr === lastHumanMove[0] && lc === lastHumanMove[1])) {
        strategicScore += 12
      }
    })

    // Central geometric board presence
    const distFromCenter = Math.abs(r - 5) + Math.abs(c - r / 2)
    strategicScore += Math.max(0, 10 - distFromCenter * 1.5)

    evaluated.push({
      move: [r, c],
      blundersGiven,
      pointsSurrendered,
      safeLinesCount,
      strategicScore,
    })
  }

  // 3. Filter strictly safe moves (0 blunders given)
  const safeMoves = evaluated.filter((m) => m.blundersGiven === 0)
  if (safeMoves.length > 0) {
    safeMoves.sort((a, b) => b.strategicScore - a.strategicScore)
    return safeMoves[0].move
  }

  // 4. If all moves force a sacrifice, minimize points given away
  evaluated.sort((a, b) => a.pointsSurrendered - b.pointsSurrendered || a.blundersGiven - b.blundersGiven)
  return evaluated[0].move
}
