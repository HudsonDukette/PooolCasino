import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

const TIERS = [
  { tier: 1, label: "10%", color: "border-green-500 bg-green-500/20 text-green-300", safe: true },
  { tier: 2, label: "25%", color: "border-blue-500 bg-blue-500/20 text-blue-300", safe: true },
  { tier: 3, label: "50%", color: "border-yellow-500 bg-yellow-500/20 text-yellow-300", safe: false },
  { tier: 4, label: "75%", color: "border-orange-500 bg-orange-500/20 text-orange-300", safe: false },
  { tier: 5, label: "ALL IN", color: "border-red-500 bg-red-500/20 text-red-300", safe: false },
] as const;

export default function RiskAuctionPvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [tier, setTier] = useState<number | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "riskauction") {
      setRounds(prev => [...prev, lastRound]);
      setSubmitted(false);
      setTier(null);
    }
  }, [lastRound]);

  const handleBid = (t: number) => {
    if (!currentMatch || submitted) return;
    setTier(t);
    setSubmitted(true);
    sendAction(currentMatch.matchId, "bid", { tier: t });
  };

  return (
    <PvPGameShell gameType="riskauction" emoji="🏛️" title="Risk Auction">
      {({ myId }) => {
        const latest = rounds[rounds.length - 1];
        const result = latest?.result;
        return (
          <div className="space-y-6">
            <div className="bg-black/30 border border-white/5 rounded-2xl p-3 text-sm text-muted-foreground text-center">
              Bid your risk tier — higher bid wins the pot! Ties are broken randomly.
            </div>
            {!submitted ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Choose your bid tier</p>
                <div className="grid grid-cols-5 gap-2">
                  {TIERS.map(t => (
                    <button key={t.tier} onClick={() => handleBid(t.tier)}
                      className={`h-16 rounded-xl border-2 font-bold text-sm transition-all ${tier === t.tier ? t.color : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center p-8 bg-black/20 border border-white/5 rounded-2xl space-y-3">
                <div className="text-5xl">🏛️</div>
                <p className="text-white font-semibold">Bid: <span className="text-amber-400">{TIERS.find(t => t.tier === tier)?.label}</span></p>
                <p className="text-muted-foreground text-sm">Waiting for opponent...</p>
              </div>
            )}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">P1 bid:</span><span className="text-amber-300 font-bold">{result.p1Label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">P2 bid:</span><span className="text-amber-300 font-bold">{result.p2Label}</span></div>
                  <div className={`text-center font-bold text-lg pt-1 ${result.roundWinnerId === myId ? "text-emerald-400" : "text-red-400"}`}>
                    {result.roundWinnerId === myId ? "✅ Higher bid wins!" : "❌ Outbid"}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {rounds.length > 0 && (
              <div className="space-y-1">
                {rounds.slice().reverse().map((r, i) => (
                  <div key={i} className="flex justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                    <span className="text-muted-foreground">R{r.round}</span>
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
