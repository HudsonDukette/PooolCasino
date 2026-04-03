import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

const LEVELS = [
  { level: 1, label: "Safe", emoji: "🟢", color: "border-green-500 bg-green-500/20 text-green-300" },
  { level: 2, label: "Low", emoji: "🟡", color: "border-yellow-500 bg-yellow-500/20 text-yellow-300" },
  { level: 3, label: "Medium", emoji: "🟠", color: "border-orange-500 bg-orange-500/20 text-orange-300" },
  { level: 4, label: "High", emoji: "🔴", color: "border-red-500 bg-red-500/20 text-red-300" },
  { level: 5, label: "Max", emoji: "💀", color: "border-purple-500 bg-purple-500/20 text-purple-300" },
] as const;

export default function BalanceBattlePvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [level, setLevel] = useState<number | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "balancebattle") {
      setRounds(prev => [...prev, lastRound]);
      setSubmitted(false);
      setLevel(null);
    }
  }, [lastRound]);

  const handlePick = (l: number) => {
    if (!currentMatch || submitted) return;
    setLevel(l);
    setSubmitted(true);
    sendAction(currentMatch.matchId, "pick", { level: l });
  };

  return (
    <PvPGameShell gameType="balancebattle" emoji="⚖️" title="Balance Battle">
      {({ myId }) => {
        const latest = rounds[rounds.length - 1];
        const result = latest?.result;
        return (
          <div className="space-y-6">
            <div className="bg-black/30 border border-white/5 rounded-2xl p-3 text-sm text-muted-foreground text-center">
              Pick a risk level 1–5. A target is drawn — whoever's pick is closest to the target wins!
            </div>
            {!submitted ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Choose your risk level</p>
                <div className="grid grid-cols-5 gap-2">
                  {LEVELS.map(l => (
                    <button key={l.level} onClick={() => handlePick(l.level)}
                      className={`h-20 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 ${level === l.level ? l.color : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30"}`}>
                      <span className="text-2xl">{l.emoji}</span>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-8 bg-black/20 border border-white/5 rounded-2xl space-y-3">
                <div className="text-5xl">{LEVELS.find(l => l.level === level)?.emoji}</div>
                <p className="text-white font-semibold">{LEVELS.find(l => l.level === level)?.label} risk chosen</p>
                <p className="text-muted-foreground text-sm">Waiting for opponent...</p>
              </div>
            )}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Target drawn:</span><span className="text-purple-400 font-bold">{result.targetLabel} (Level {result.target})</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">P1 picked:</span><span className="text-white font-semibold">{result.p1Label} (off by {result.p1Diff})</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">P2 picked:</span><span className="text-white font-semibold">{result.p2Label} (off by {result.p2Diff})</span></div>
                  <div className={`text-center font-bold text-lg pt-1 ${result.roundWinnerId === myId ? "text-emerald-400" : "text-red-400"}`}>
                    {result.roundWinnerId === myId ? "✅ Closer to target!" : "❌ Opponent was closer"}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {rounds.length > 0 && (
              <div className="space-y-1">
                {rounds.slice().reverse().map((r, i) => (
                  <div key={i} className="flex justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                    <span className="text-muted-foreground">R{r.round} — Target: {r.result?.targetLabel}</span>
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
