import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

export default function DuelFlipPvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [choice, setChoice] = useState<"call" | "fold" | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "duelflip") {
      setRounds(prev => [...prev, lastRound]);
      setChoice(null);
      setSubmitted(false);
    }
  }, [lastRound]);

  const handleChoose = (c: "call" | "fold") => {
    if (!currentMatch || submitted) return;
    setChoice(c);
    setSubmitted(true);
    sendAction(currentMatch.matchId, "pick", { choice: c });
  };

  return (
    <PvPGameShell gameType="duelflip" emoji="🪙" title="Duel Flip">
      {({ myId }) => {
        const latest = rounds[rounds.length - 1];
        const result = latest?.result;
        return (
          <div className="space-y-6">
            <div className="bg-black/30 border border-white/5 rounded-2xl p-3 text-sm text-muted-foreground text-center">
              Call = face the coin. Fold = concede. Call vs Call = coin decides. Fold = guaranteed loss.
            </div>
            {!submitted ? (
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => handleChoose("call")} className="h-24 text-xl font-bold bg-yellow-600 hover:bg-yellow-500 flex-col gap-1">
                  <span className="text-3xl">🪙</span> Call
                </Button>
                <Button onClick={() => handleChoose("fold")} className="h-24 text-xl font-bold bg-gray-600 hover:bg-gray-500 flex-col gap-1">
                  <span className="text-3xl">✋</span> Fold
                </Button>
              </div>
            ) : (
              <div className="text-center p-8 bg-black/20 border border-white/5 rounded-2xl space-y-3">
                <div className="text-5xl">{choice === "call" ? "🪙" : "✋"}</div>
                <p className="text-white font-semibold">You <span className="text-yellow-400">{choice?.toUpperCase()}</span></p>
                <p className="text-muted-foreground text-sm">Waiting for opponent...</p>
              </div>
            )}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                  {result.flip && <div className="flex justify-between"><span className="text-muted-foreground">Coin landed:</span><span className="font-bold text-yellow-400 capitalize">{result.flip}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">P1:</span><span className="text-white capitalize">{result.p1Choice}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">P2:</span><span className="text-white capitalize">{result.p2Choice}</span></div>
                  <div className={`text-center font-bold text-lg pt-1 ${result.roundWinnerId === myId ? "text-emerald-400" : result.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                    {result.roundWinnerId === myId ? "✅ You win this round!" : result.roundWinnerId === null ? "🤝 Draw!" : "❌ Opponent wins"}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {rounds.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Best of {currentMatch?.totalRounds ?? 5}</p>
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
