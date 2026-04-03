import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PvPGameShell from "@/components/PvPGameShell";

export default function NumGuessPvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [guess, setGuess] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "numguess") {
      setRounds(prev => [...prev, lastRound]);
      setSubmitted(false);
      setGuess("");
    }
  }, [lastRound]);

  const handleSubmit = () => {
    const n = parseInt(guess);
    if (isNaN(n) || n < 1 || n > 100 || !currentMatch || submitted) return;
    setSubmitted(true);
    sendAction(currentMatch.matchId, "guess", { guess: n });
  };

  return (
    <PvPGameShell gameType="numguess" emoji="🔢" title="Number Guess">
      {({ myId, opponent }) => {
        const latestRound = rounds[rounds.length - 1];
        const result = latestRound?.result;
        const isP1 = myId < opponent.userId;

        return (
          <div className="space-y-6">
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center space-y-4">
              <p className="text-muted-foreground text-sm">Guess a number between 1 and 100 — closest wins!</p>
              {result ? (
                <motion.div key={rounds.length} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="text-5xl font-black text-primary">{result.target}</div>
                  <p className="text-sm text-muted-foreground">The number was</p>
                  <div className="flex justify-center gap-8 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground">Your guess</p>
                      <p className="font-bold text-white text-lg">{isP1 ? result.p1Guess : result.p2Guess}</p>
                      <p className="text-xs text-muted-foreground">off by {isP1 ? result.p1Dist : result.p2Dist}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">{opponent.username}</p>
                      <p className="font-bold text-white text-lg">{isP1 ? result.p2Guess : result.p1Guess}</p>
                      <p className="text-xs text-muted-foreground">off by {isP1 ? result.p2Dist : result.p1Dist}</p>
                    </div>
                  </div>
                  <p className={`font-semibold text-lg ${result.roundWinnerId === myId ? "text-green-400" : result.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                    {result.roundWinnerId === myId ? "✅ Closer guess!" : result.roundWinnerId === null ? "🤝 Tie!" : "❌ Opponent was closer"}
                  </p>
                </motion.div>
              ) : (
                <div className="text-muted-foreground">
                  {submitted ? `You guessed ${guess} — waiting for ${opponent.username}...` : "Enter your guess"}
                </div>
              )}
            </div>

            {!submitted && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="1 – 100"
                  className="text-center text-lg h-12"
                />
                <Button onClick={handleSubmit} className="h-12 px-6">Guess</Button>
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
                      <span>Target: {res.target}</span>
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
