// === SHARED CONSTANTS (must match plinko.tsx) ===
export const PLINKO_ROWS = 8;
export const PLINKO_ROW_HEIGHT = 44;   // px per row
export const PLINKO_PEG_SPACING = 42;  // px between pegs in same row

export function calculateWinChance(betAmount: number, poolTotal: number): number {
  if (poolTotal <= 0) return 0.01;
  // Cap the scaling at $5000 so large pool refills don't nullify bet-size pressure.
  // A $5000 bet always cuts win chance in half regardless of pool size.
  const scale = Math.min(poolTotal * 0.001, 5000);
  const pressure = betAmount / scale;
  return Math.max(0.01, 0.45 / (1 + pressure));
}

export function shouldWin(betAmount: number, poolTotal: number): boolean {
  const chance = calculateWinChance(betAmount, poolTotal);
  return Math.random() < chance;
}

export const ROULETTE_NUMBERS: { number: number; color: "red" | "black" | "green" }[] = [
  { number: 0, color: "green" },
  { number: 1, color: "red" },
  { number: 2, color: "black" },
  { number: 3, color: "red" },
  { number: 4, color: "black" },
  { number: 5, color: "red" },
  { number: 6, color: "black" },
  { number: 7, color: "red" },
  { number: 8, color: "black" },
  { number: 9, color: "red" },
  { number: 10, color: "black" },
  { number: 11, color: "black" },
  { number: 12, color: "red" },
  { number: 13, color: "black" },
  { number: 14, color: "red" },
  { number: 15, color: "black" },
  { number: 16, color: "red" },
  { number: 17, color: "black" },
  { number: 18, color: "red" },
  { number: 19, color: "red" },
  { number: 20, color: "black" },
  { number: 21, color: "red" },
  { number: 22, color: "black" },
  { number: 23, color: "red" },
  { number: 24, color: "black" },
  { number: 25, color: "red" },
  { number: 26, color: "black" },
  { number: 27, color: "red" },
  { number: 28, color: "black" },
  { number: 29, color: "black" },
  { number: 30, color: "red" },
  { number: 31, color: "black" },
  { number: 32, color: "red" },
  { number: 33, color: "black" },
  { number: 34, color: "red" },
  { number: 35, color: "black" },
  { number: 36, color: "red" },
];

export const PLINKO_MULTIPLIERS = {
  low:    [0.5, 1, 1.5, 2, 2.5, 2, 1.5, 1, 0.5],
  medium: [0.3, 0.5, 1, 2, 5, 2, 1, 0.5, 0.3],
  high:   [0.1, 0.2, 0.5, 1, 10, 1, 0.5, 0.2, 0.1],
};

// -----------------------------------------------------------------------
// Physics-based plinko path generator
// Simulates gravity, peg collisions, and natural arc motion.
// Returns smooth (x, y) coordinates in pixels (origin = board top center).
// -----------------------------------------------------------------------

interface Vec2 { x: number; y: number }

const GRAVITY     = 1400;  // px / s²
const DAMPING     = 0.72;  // velocity multiplier on peg hit
const DT          = 1 / 60; // 60 fps timestep (seconds)
const BALL_RADIUS = 6;
const PEG_RADIUS  = 5;

/** All peg positions on the 8-row triangular board */
function buildPegGrid(): Vec2[] {
  const pegs: Vec2[] = [];
  for (let row = 1; row <= PLINKO_ROWS; row++) {
    const count = row + 1;
    const startX = -((count - 1) * PLINKO_PEG_SPACING) / 2;
    for (let p = 0; p < count; p++) {
      pegs.push({
        x: startX + p * PLINKO_PEG_SPACING,
        y: row * PLINKO_ROW_HEIGHT,
      });
    }
  }
  return pegs;
}

const PEG_GRID = buildPegGrid();

/** Resolve ball-peg collision, reflect velocity with damping + small random kick */
function resolveCollision(
  bx: number, by: number,
  vx: number, vy: number,
  peg: Vec2,
): { vx: number; vy: number } | null {
  const dx = bx - peg.x;
  const dy = by - peg.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = BALL_RADIUS + PEG_RADIUS;
  if (dist >= minDist || dist < 0.001) return null;

  // Normalised collision normal (from peg center to ball center)
  const nx = dx / dist;
  const ny = dy / dist;

  // Only resolve if ball is moving toward peg (approaching)
  const dot = vx * nx + vy * ny;
  if (dot >= 0) return null; // already moving away, skip

  // Reflect velocity: v' = v - 2*(v·n)*n
  let rvx = (vx - 2 * dot * nx) * DAMPING;
  let rvy = (vy - 2 * dot * ny) * DAMPING;

  // Add tiny lateral kick for natural unpredictability
  const kick = (Math.random() - 0.5) * 40;
  rvx += kick;

  return { vx: rvx, vy: rvy };
}

/**
 * Simulate Plinko physics with odds-controlled target slot.
 * 1. Win/loss decided by pool odds.
 * 2. A suitable slot is chosen (win → high-mult slot, loss → low-mult slot).
 * 3. Physics simulation runs with initial x-velocity biased toward that slot.
 * 4. Returns smooth {x,y} path + confirmed slot + multiplier.
 */
export function simulatePlinko(
  risk: "low" | "medium" | "high",
  winChance: number,
): { path: Vec2[]; slot: number; multiplier: number } {
  const multipliers = PLINKO_MULTIPLIERS[risk];
  const doWin = Math.random() < winChance;

  const winSlots  = multipliers.map((m, i) => ({ m, i })).filter(({ m }) => m > 1.0);
  const loseSlots = multipliers.map((m, i) => ({ m, i })).filter(({ m }) => m <= 1.0);
  const candidates = doWin && winSlots.length > 0 ? winSlots : loseSlots;
  const { m: multiplier, i: targetSlot } =
    candidates[Math.floor(Math.random() * candidates.length)];

  // Target x: slot 0→left edge, slot 4→center, slot 8→right edge
  const targetX = (targetSlot - (PLINKO_ROWS / 2)) * PLINKO_PEG_SPACING;

  // Run the physics sim, retry up to 4 times if ball drifts badly from target
  const MAX_TRIES = 4;
  let bestPath: Vec2[] = [];
  let bestSlot = targetSlot;
  let bestDist = Infinity;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    // Initial velocity: horizontal bias toward target + tiny random jitter
    const vx0 = (targetX / (PLINKO_ROWS * PLINKO_ROW_HEIGHT)) * 160
               + (Math.random() - 0.5) * 20;

    let bx = 0, by = 0;
    let vx = vx0, vy = 30; // small initial downward nudge

    const raw: Vec2[] = [{ x: bx, y: by }];
    const BOARD_BOTTOM = PLINKO_ROWS * PLINKO_ROW_HEIGHT + PLINKO_ROW_HEIGHT;
    const MAX_STEPS = 800;

    for (let step = 0; step < MAX_STEPS; step++) {
      vy += GRAVITY * DT;
      bx += vx * DT;
      by += vy * DT;

      // Peg collision — check all pegs near current y row for speed
      for (let pi = 0; pi < PEG_GRID.length; pi++) {
        const peg = PEG_GRID[pi];
        if (Math.abs(by - peg.y) > PLINKO_ROW_HEIGHT) continue;
        const result = resolveCollision(bx, by, vx, vy, peg);
        if (result) {
          vx = result.vx;
          vy = result.vy;
          break; // only one collision per step
        }
      }

      // Sample path every 4 frames for smooth but compact path
      if (step % 4 === 0) raw.push({ x: bx, y: by });

      if (by >= BOARD_BOTTOM) {
        raw.push({ x: bx, y: BOARD_BOTTOM });
        break;
      }
    }

    // Determine actual landed slot from final x position
    // slot S is centered at x = (S - ROWS/2) * PEG_SPACING, so S = x/PEG_SPACING + ROWS/2
    const rawSlot = Math.round(bx / PLINKO_PEG_SPACING + PLINKO_ROWS / 2);
    const landedSlot = Math.max(0, Math.min(PLINKO_ROWS, rawSlot));

    const dist = Math.abs(landedSlot - targetSlot);
    if (dist < bestDist) {
      bestDist = dist;
      bestPath = raw;
      bestSlot = landedSlot;
    }
    if (bestDist === 0) break;
  }

  // Use the actual physics landing slot and its real multiplier
  const actualMultiplier = multipliers[bestSlot] ?? 0;
  return { path: bestPath, slot: bestSlot, multiplier: actualMultiplier };
}
