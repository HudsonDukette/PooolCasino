export interface BJPvPState {
  deck: number[];
  hands: Record<number, number[]>;
  busted: Record<number, boolean>;
  standing: Record<number, boolean>;
}

function shuffleDeck(): number[] {
  const deck: number[] = [];
  for (let i = 0; i < 4; i++) {
    for (let v = 1; v <= 13; v++) deck.push(Math.min(v, 10));
  }
  return deck.sort(() => Math.random() - 0.5);
}

function handTotal(cards: number[]): number {
  let total = cards.reduce((a, b) => a + b, 0);
  let aces = cards.filter(c => c === 1).length;
  while (aces > 0 && total + 10 <= 21) { total += 10; aces--; }
  return total;
}

export function initGameState(p1Id: number, p2Id: number): BJPvPState {
  const deck = shuffleDeck();
  const p1Hand = [deck.pop()!, deck.pop()!];
  const p2Hand = [deck.pop()!, deck.pop()!];
  return {
    deck,
    hands: { [p1Id]: p1Hand, [p2Id]: p2Hand },
    busted: { [p1Id]: false, [p2Id]: false },
    standing: { [p1Id]: false, [p2Id]: false },
  };
}

export function getInitialState(state: BJPvPState, p1Id: number, p2Id: number) {
  return {
    p1Total: handTotal(state.hands[p1Id] ?? []),
    p2Total: handTotal(state.hands[p2Id] ?? []),
    p1Hand: state.hands[p1Id],
    p2Hand: state.hands[p2Id],
  };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: BJPvPState,
  userId: number,
  action: string,
  _payload: any
): null | {
  roundDone: boolean;
  roundWinnerId: number | null;
  result: any;
  stateUpdate: Partial<BJPvPState>;
  gameDone?: boolean;
  gameWinnerId?: number | null;
} {
  if (!["hit", "stand"].includes(action)) return null;
  if (state.busted[userId] || state.standing[userId]) return null;

  const deck = [...state.deck];
  const hands = { ...state.hands, [userId]: [...(state.hands[userId] ?? [])] };
  const busted = { ...state.busted };
  const standing = { ...state.standing };
  let drawnCard: number | null = null;

  if (action === "hit") {
    drawnCard = deck.pop() ?? 10;
    hands[userId] = [...hands[userId], drawnCard];
    const total = handTotal(hands[userId]);
    if (total > 21) busted[userId] = true;
  } else {
    standing[userId] = true;
  }

  const bothDone = (busted[p1Id] || standing[p1Id]) && (busted[p2Id] || standing[p2Id]);

  let gameWinnerId: number | null = null;
  if (bothDone) {
    const p1Valid = !busted[p1Id];
    const p2Valid = !busted[p2Id];
    const p1Total = handTotal(hands[p1Id] ?? []);
    const p2Total = handTotal(hands[p2Id] ?? []);
    if (!p1Valid && !p2Valid) gameWinnerId = null;
    else if (!p1Valid) gameWinnerId = p2Id;
    else if (!p2Valid) gameWinnerId = p1Id;
    else if (p1Total > p2Total) gameWinnerId = p1Id;
    else if (p2Total > p1Total) gameWinnerId = p2Id;
  }

  const result = {
    userId,
    action,
    drawnCard,
    hands,
    totals: {
      [p1Id]: handTotal(hands[p1Id] ?? []),
      [p2Id]: handTotal(hands[p2Id] ?? []),
    },
    busted,
    standing,
    bothDone,
    gameWinnerId: bothDone ? gameWinnerId : undefined,
  };

  return {
    roundDone: bothDone,
    roundWinnerId: bothDone ? gameWinnerId : null,
    result,
    stateUpdate: { deck, hands, busted, standing },
    gameDone: bothDone,
    gameWinnerId: bothDone ? gameWinnerId : null,
  };
}
