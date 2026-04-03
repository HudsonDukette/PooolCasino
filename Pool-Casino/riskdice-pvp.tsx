import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

export default function RiskDicePvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [pick, setPick] = useState<number | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "riskdice") {
      setRounds(prev => [...prev, lastRound]);
      setPick(null);
      setSubmitted(false);
    }
  }, [lastRound]);

  const handlePick = (n: number) => {
    if (!currentMatch || submitted) return;
    setPick(n);
    setSubmitted(true);
    sendAction(currentMatch.matchId, "pick", { number: n });
  };

  return (
    <PvPGameShell gameType="riskdice" emoji="🎲" title="Risk Dice">
      {({ myId }) => {
        const latest = rounds[rounds.length - 1];
        const result = latest?.result;
        return (
          <div className="space-y-6">
            <div className="bg-black/30 border border-white/5 rounded-2xl p-3 text-sm text-muted-foreground text-center">
              Pick a number 1–6. A die is rolled — whoever's pick is closest wins the round!
            </div>
            {!submitted ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Pick your number (1–6)</p>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <button key={n} onClick={() => handlePick(n)}
                      className={`h-14 rounded-xl border-2 font-black text-xl transition-all ${pick === n ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-8 bg-black/20 border border-white/5 rounded-2xl space-y-3">
                <div className="text-5xl">🎲</div>
                <p className="text-white font-semibold">You picked <span className="text-purple-400">{pick}</span></p>
                <p className="text-muted-foreground text-sm">Waiting for opponent to pick...</p>
              </div>
            )}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Die rolled:</span><span className="text-yellow-400 font-black text-xl">🎲 {result.roll}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">P1 picked:</span><span className="text-white font-semibold">{result.p1Pick} (off by {result.p1Diff})</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">P2 picked:</span><span className="text-white font-semibold">{result.p2Pick} (off by {result.p2Diff})</span></div>
                  <div className={`text-center font-bold text-lg pt-1 ${result.roundWinnerId === myId ? "text-emerald-400" : result.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                    {result.roundWinnerId === myId ? "✅ Closer guess!" : "❌ Opponent was closer"}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {rounds.length > 0 && (
              <div className="space-y-1">
                {rounds.slice().reverse().map((r, i) => (
                  <div key={i} className="flex justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                    <span className="text-muted-foreground">R{r.round} — Die: {r.result?.roll}</span>
                    <span className={r.result?.roundWinnerId === myId ? "text-emerald-400" : "text-red-400"}>
                      {r.result?.roundWinnerId === myId ? "Win" : "Loss"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }}
    </PvPGameShell>
  );
}
