import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PvPGameShell from "@/components/PvPGameShell";

export default function QuickMathPvP() {
  const { currentMatch, lastRound, pvpEvent, sendAction } = useMultiplayer();
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [rounds, setRounds] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pvpEvent?.event === "quickmath:question" && currentMatch?.gameType === "quickmath") {
      setQuestion(pvpEvent.data.question);
      setAnswer("");
      setSubmitted(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pvpEvent]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "quickmath") {
      setRounds(prev => [...prev, lastRound]);
    }
  }, [lastRound]);

  const handleSubmit = () => {
    const n = parseInt(answer);
    if (isNaN(n) || !currentMatch || submitted) return;
    setSubmitted(true);
    sendAction(currentMatch.matchId, "answer", { answer: n });
  };

  return (
    <PvPGameShell gameType="quickmath" emoji="🧮" title="Quick Math">
      {({ myId, opponent }) => {
        const latestRound = rounds[rounds.length - 1];
        const result = latestRound?.result;

        return (
          <div className="space-y-6">
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center space-y-4">
              {question ? (
                <>
                  <p className="text-muted-foreground text-sm">Fastest correct answer wins the round!</p>
                  <motion.div
                    key={question}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-4xl font-black text-white py-4"
                  >
                    {question} = ?
                  </motion.div>
                  {result && result.question === question ? (
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-primary">Answer: {result.answer}</p>
                      <p className="text-sm text-muted-foreground">
                        You: {result.p1Answer ?? result.p2Answer} ({result.p1Correct || result.p2Correct ? "✓" : "✗"})
                      </p>
                      <p className={`font-semibold ${result.roundWinnerId === myId ? "text-green-400" : result.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                        {result.roundWinnerId === myId ? "✅ Fastest!" : result.roundWinnerId === null ? "🤝 Tie!" : "❌ Opponent faster"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{submitted ? `Answered ${answer} — waiting for ${opponent.username}...` : "Type your answer"}</p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground animate-pulse">Get ready... first question coming!</p>
              )}
            </div>

            {question && !submitted && (
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  type="number"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="Your answer"
                  className="text-center text-lg h-12"
                  autoFocus
                />
                <Button onClick={handleSubmit} className="h-12 px-6">Submit</Button>
              </div>
            )}

            {rounds.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Round History</p>
                {rounds.slice().reverse().map((r, i) => {
                  const res = r.result;
                  return (
                    <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                      <span className="text-muted-foreground">R{r.round}</span>
                      <span>{res.question} = {res.answer}</span>
                      <span className={res.roundWinnerId === myId ? "text-green-400" : res.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}>
                        {res.roundWinnerId === myId ? "Win" : res.roundWinnerId === null ? "Tie" : "Loss"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }}
    </PvPGameShell>
  );
}
