export type HighLowGuess = "higher" | "lower";

export interface HighLowRoundResult {
  firstRoll: number;
  secondRoll: number;
  p1Guess: HighLowGuess;
  p2Guess: HighLowGuess;
  actual: "higher" | "lower" | "same";
  winnerId: number | null;
}

function roll(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function playHighLowRound(
  player1Id: number,
  player2Id: number,
  p1Guess: HighLowGuess,
  p2Guess: HighLowGuess,
): HighLowRoundResult {
  const first = roll();
  const second = roll();

  let actual: "higher" | "lower" | "same";
  if (second > first) actual = "higher";
  else if (second < first) actual = "lower";
  else actual = "same";

  const p1Correct = actual !== "same" && p1Guess === actual;
  const p2Correct = actual !== "same" && p2Guess === actual;

  let winnerId: number | null = null;
  if (p1Correct && !p2Correct) winnerId = player1Id;
  else if (p2Correct && !p1Correct) winnerId = player2Id;

  return { firstRoll: first, secondRoll: second, p1Guess, p2Guess, actual, winnerId };
}
