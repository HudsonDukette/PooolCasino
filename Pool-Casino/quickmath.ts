export interface QuickMathQuestion {
  a: number;
  b: number;
  op: "+" | "-" | "*";
  answer: number;
  display: string;
}

export interface QuickMathState {
  question: QuickMathQuestion;
  answers: Record<number, { value: number; timestamp: number }>;
}

function generateQuestion(): QuickMathQuestion {
  const ops: Array<"+" | "-" | "*"> = ["+", "-", "*"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;
  if (op === "+") {
    a = Math.floor(Math.random() * 50) + 1;
    b = Math.floor(Math.random() * 50) + 1;
    answer = a + b;
  } else if (op === "-") {
    a = Math.floor(Math.random() * 50) + 20;
    b = Math.floor(Math.random() * a) + 1;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 12) + 2;
    b = Math.floor(Math.random() * 12) + 2;
    answer = a * b;
  }
  return { a, b, op, answer, display: `${a} ${op} ${b}` };
}

export function initGameState(): QuickMathState {
  return { question: generateQuestion(), answers: {} };
}

export function getInitialQuestion(state: QuickMathState): QuickMathQuestion {
  return state.question;
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: QuickMathState,
  userId: number,
  action: string,
  payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<QuickMathState> } {
  if (action !== "answer") return null;
  const value = parseInt(payload?.answer);
  if (isNaN(value)) return null;
  if (state.answers[userId] !== undefined) return null;

  const timestamp = Date.now();
  const updated = { ...state.answers, [userId]: { value, timestamp } };

  if (updated[p1Id] === undefined || updated[p2Id] === undefined) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { answers: updated } };
  }

  const { answer, display } = state.question;
  const p1Ans = updated[p1Id];
  const p2Ans = updated[p2Id];
  const p1Correct = p1Ans.value === answer;
  const p2Correct = p2Ans.value === answer;

  let roundWinnerId: number | null = null;
  if (p1Correct && p2Correct) {
    roundWinnerId = p1Ans.timestamp <= p2Ans.timestamp ? p1Id : p2Id;
  } else if (p1Correct) {
    roundWinnerId = p1Id;
  } else if (p2Correct) {
    roundWinnerId = p2Id;
  }

  const result = {
    question: display,
    answer,
    p1Answer: p1Ans.value,
    p2Answer: p2Ans.value,
    p1Correct,
    p2Correct,
    roundWinnerId,
  };
  return { roundDone: true, roundWinnerId, result, stateUpdate: { question: generateQuestion(), answers: {} } };
}
