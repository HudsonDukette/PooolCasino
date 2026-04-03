export type BidTier = 1 | 2 | 3 | 4 | 5;

export interface RiskAuctionState {
  bids: Record<number, BidTier>;
}

export function initGameState(): RiskAuctionState {
  return { bids: {} };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: RiskAuctionState,
  userId: number,
  action: string,
  payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<RiskAuctionState> } {
  if (action !== "bid") return null;
  const bid = payload?.tier as BidTier;
  if (![1, 2, 3, 4, 5].includes(bid)) return null;
  if (state.bids[userId] !== undefined) return null;

  const updated = { ...state.bids, [userId]: bid };

  if (updated[p1Id] === undefined || updated[p2Id] === undefined) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { bids: updated } };
  }

  const p1Bid = updated[p1Id];
  const p2Bid = updated[p2Id];

  let roundWinnerId: number | null = null;
  if (p1Bid > p2Bid) {
    roundWinnerId = p1Id;
  } else if (p2Bid > p1Bid) {
    roundWinnerId = p2Id;
  } else {
    roundWinnerId = Math.random() < 0.5 ? p1Id : p2Id;
  }

  const tierLabels: Record<BidTier, string> = { 1: "10%", 2: "25%", 3: "50%", 4: "75%", 5: "ALL IN" };
  const result = {
    p1Bid, p2Bid,
    p1Label: tierLabels[p1Bid], p2Label: tierLabels[p2Bid],
    roundWinnerId,
  };
  return { roundDone: true, roundWinnerId, result, stateUpdate: { bids: {} } };
}
