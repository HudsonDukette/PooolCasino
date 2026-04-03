import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

export default function SplitOrStealPvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [choice, setChoice] = useState<"split" | "steal" | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "splitorsteal") {
      setRounds(prev => [...prev, lastRound]);
      setChoice(null);
      setSubmitted(false);
    }
  }, [lastRound]);

  const handleChoose = (c: "split" | "steal") => {
    if (!currentMatch || submitted) return;
    setChoice(c);
    setSubmitted(true);
    sendAction(currentMatch.matchId, "pick", { choice: c });
  };

  return (
    <PvPGameShell gameType="splitorsteal" emoji="🤝" title="Split or Steal">
      {({ myId }) => {
        const latest = rounds[rounds.length - 1];
        const result = latest?.result;
        return (
          <div className="space-y-6">
            <div className="bg-black/30 border border-white/5 rounded-2xl p-3 text-sm text-muted-foreground text-center">
              Split = both gain a point. Steal = only you gain. Both steal = nobody gains.
            </div>
            {!submitted ? (
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => handleChoose("split")} className="h-24 text-xl font-bold bg-emerald-600 hover:bg-emerald-500 flex-col gap-1">
                  <span className="text-3xl">🤝</span> Split
                </Button>
                <Button onClick={() => handleChoose("steal")} className="h-24 text-xl font-bold bg-red-600 hover:bg-red-500 flex-col gap-1">
                  <span className="text-3xl">🗡️</span> Steal
                </Button>
              </div>
            ) : (
              <div className="text-center p-8 bg-black/20 border border-white/5 rounded-2xl space-y-3">
                <div className="text-5xl">{choice === "split" ? "🤝" : "🗡️"}</div>
                <p className="text-white font-semibold">You chose <span className={choice === "split" ? "text-emerald-400" : "text-red-400"}>{choice?.toUpperCase()}</span></p>
                <p className="text-muted-foreground text-sm">Waiting for opponent...</p>
              </div>
            )}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">P1 chose:</span><span className="text-white font-semibold capitalize">{result.p1Choice}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">P2 chose:</span><span className="text-white font-semibold capitalize">{result.p2Choice}</span></div>
                  <div className={`text-center font-bold text-lg pt-1 ${result.roundWinnerId === myId ? "text-emerald-400" : result.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                    {result.roundWinnerId === myId ? "✅ You win this round!" : result.roundWinnerId === null ? "🤝 Both steal — no one gains" : "❌ Opponent wins"}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {rounds.length > 0 && (
              <div className="space-y-1">
                {rounds.slice().reverse().map((r, i) => (
                  <div key={i} className="flex justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                    <span className="text-muted-foreground">R{r.round}</span>
                    <span className={r.result?.roundWinnerId === myId ? "text-emerald-400" : r.result?.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}>
                      {r.result?.roundWinnerId === myId ? "Win" : r.result?.roundWinnerId === null ? "Tie" : "Loss"}
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
