export interface PokerState {
  hands: Record<number, number[]>;
  result: any;
}

function shuffleDeck(): number[] {
  const deck: number[] = [];
  for (let i = 0; i < 4; i++) for (let v = 1; v <= 13; v++) deck.push(v);
  return deck.sort(() => Math.random() - 0.5);
}

type HandRank = {
  rank: number;
  name: string;
  tiebreakers: number[];
};

function counts(hand: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of hand) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
}

function isFlush(suits: number[]): boolean {
  return suits.every(s => s === suits[0]);
}

function isStraight(vals: number[]): boolean {
  const sorted = [...new Set(vals)].sort((a, b) => a - b);
  if (sorted.length < 5) return false;
  if (sorted[4] - sorted[0] === 4) return true;
  if (sorted.join(",") === "1,10,11,12,13") return true;
  return false;
}

function evaluateHand(hand: number[], suits: number[]): HandRank {
  const c = counts(hand);
  const vals = hand.slice().sort((a, b) => b - a);
  const flush = isFlush(suits);
  const straight = isStraight(hand);
  const groups = [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const [top, second] = groups;

  if (straight && flush) return { rank: 8, name: straight && hand.includes(1) && hand.includes(13) ? "Royal Flush" : "Straight Flush", tiebreakers: vals };
  if (top[1] === 4) return { rank: 7, name: "Four of a Kind", tiebreakers: [top[0], second?.[0] ?? 0] };
  if (top[1] === 3 && second?.[1] === 2) return { rank: 6, name: "Full House", tiebreakers: [top[0], second[0]] };
  if (flush) return { rank: 5, name: "Flush", tiebreakers: vals };
  if (straight) return { rank: 4, name: "Straight", tiebreakers: vals };
  if (top[1] === 3) return { rank: 3, name: "Three of a Kind", tiebreakers: [top[0], ...vals] };
  if (top[1] === 2 && second?.[1] === 2) return { rank: 2, name: "Two Pair", tiebreakers: [top[0], second[0], vals.find(v => v !== top[0] && v !== second[0]) ?? 0] };
  if (top[1] === 2) return { rank: 1, name: "One Pair", tiebreakers: [top[0], ...vals.filter(v => v !== top[0])] };
  return { rank: 0, name: "High Card", tiebreakers: vals };
}

function compareHands(h1: HandRank, h2: HandRank): -1 | 0 | 1 {
  if (h1.rank !== h2.rank) return h1.rank > h2.rank ? 1 : -1;
  for (let i = 0; i < h1.tiebreakers.length; i++) {
    if (h1.tiebreakers[i] !== h2.tiebreakers[i]) return h1.tiebreakers[i] > h2.tiebreakers[i] ? 1 : -1;
  }
  return 0;
}

export function initGameState(p1Id: number, p2Id: number): PokerState {
  const deck = shuffleDeck();
  const suitDeck: number[] = [];
  for (let s = 0; s < 4; s++) for (let v = 0; v < 13; v++) suitDeck.push(s);
  const suitShuffled = suitDeck.sort(() => Math.random() - 0.5);

  const p1Hand = deck.slice(0, 5);
  const p1Suits = suitShuffled.slice(0, 5);
  const p2Hand = deck.slice(5, 10);
  const p2Suits = suitShuffled.slice(5, 10);

  const p1Eval = evaluateHand(p1Hand, p1Suits);
  const p2Eval = evaluateHand(p2Hand, p2Suits);
  const cmp = compareHands(p1Eval, p2Eval);

  const winnerId = cmp === 1 ? p1Id : cmp === -1 ? p2Id : null;

  return {
    hands: { [p1Id]: p1Hand, [p2Id]: p2Hand },
    result: {
      p1Hand,
      p2Hand,
      p1Eval: { rank: p1Eval.rank, name: p1Eval.name },
      p2Eval: { rank: p2Eval.rank, name: p2Eval.name },
      winnerId,
    },
  };
}

export function handleAction(): null {
  return null;
}
