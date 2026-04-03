export interface CardRaceState {
  totals: Record<number, number>;
  busted: Record<number, boolean>;
  standing: Record<number, boolean>;
}

export function initGameState(p1Id: number, p2Id: number): CardRaceState {
  return {
    totals: { [p1Id]: 0, [p2Id]: 0 },
    busted: { [p1Id]: false, [p2Id]: false },
    standing: { [p1Id]: false, [p2Id]: false },
  };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: CardRaceState,
  userId: number,
  action: string,
  _payload: any
): null | {
  roundDone: boolean;
  roundWinnerId: number | null;
  result: any;
  stateUpdate: Partial<CardRaceState>;
  gameDone?: boolean;
  gameWinnerId?: number | null;
} {
  if (!["draw", "stand"].includes(action)) return null;
  if (state.busted[userId] || state.standing[userId]) return null;

  let newTotals = { ...state.totals };
  let newBusted = { ...state.busted };
  let newStanding = { ...state.standing };
  let drawnCard: number | null = null;

  if (action === "stand") {
    newStanding[userId] = true;
  } else {
    drawnCard = Math.floor(Math.random() * 10) + 1;
    newTotals[userId] = (newTotals[userId] ?? 0) + drawnCard;
    if (newTotals[userId] > 21) {
      newBusted[userId] = true;
    }
  }

  const bothDone =
    (newStanding[p1Id] || newBusted[p1Id]) &&
    (newStanding[p2Id] || newBusted[p2Id]);

  let gameWinnerId: number | null = null;
  if (bothDone) {
    const p1Valid = !newBusted[p1Id];
    const p2Valid = !newBusted[p2Id];
    if (!p1Valid && !p2Valid) gameWinnerId = null;
    else if (!p1Valid) gameWinnerId = p2Id;
    else if (!p2Valid) gameWinnerId = p1Id;
    else if (newTotals[p1Id] > newTotals[p2Id]) gameWinnerId = p1Id;
    else if (newTotals[p2Id] > newTotals[p1Id]) gameWinnerId = p2Id;
  }

  const result = {
    userId,
    action,
    drawnCard,
    totals: newTotals,
    busted: newBusted,
    standing: newStanding,
    bothDone,
    gameWinnerId: bothDone ? gameWinnerId : undefined,
  };

  return {
    roundDone: bothDone,
    roundWinnerId: bothDone ? gameWinnerId : null,
    result,
    stateUpdate: { totals: newTotals, busted: newBusted, standing: newStanding },
    gameDone: bothDone,
    gameWinnerId: bothDone ? gameWinnerId : null,
  };
}
