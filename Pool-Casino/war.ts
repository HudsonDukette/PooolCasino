export interface WarCard {
  value: number;
  suit: "♠" | "♥" | "♦" | "♣";
  label: string;
}

const SUITS: WarCard["suit"][] = ["♠", "♥", "♦", "♣"];
const LABELS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

function randomCard(): WarCard {
  const value = Math.floor(Math.random() * 13) + 2;
  const suit = SUITS[Math.floor(Math.random() * 4)];
  const label = LABELS[value - 2];
  return { value, suit, label };
}

export interface WarRoundResult {
  player1Card: WarCard;
  player2Card: WarCard;
  winnerId: number | null;
}

export function playWarRound(player1Id: number, player2Id: number): WarRoundResult {
  const p1 = randomCard();
  const p2 = randomCard();

  let winnerId: number | null = null;
  if (p1.value > p2.value) winnerId = player1Id;
  else if (p2.value > p1.value) winnerId = player2Id;

  return { player1Card: p1, player2Card: p2, winnerId };
}
