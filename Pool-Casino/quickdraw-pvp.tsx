import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

type Phase = "idle" | "waiting" | "decoy" | "draw" | "result";

export default function QuickDrawPvP() {
  const { currentMatch, lastRound, pvpEvent, sendAction } = useMultiplayer();
  const [phase, setPhase] = useState<Phase>("idle");
  const [rounds, setRounds] = useState<any[]>([]);
  const [drew, setDrew] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pvpEvent || currentMatch?.gameType !== "quickdraw") return;
    if (pvpEvent.event === "quickdraw:waiting") { setPhase("waiting"); setDrew(false); }
    if (pvpEvent.event === "quickdraw:decoy") { setPhase("decoy"); }
    if (pvpEvent.event === "quickdraw:draw") { setPhase("draw"); startRef.current = Date.now(); }
  }, [pvpEvent, currentMatch?.gameType]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "quickdraw") {
      setRounds(prev => [...prev, lastRound]);
      setPhase("result");
      setDrew(false);
    }
  }, [lastRound]);

  const handleDraw = () => {
    if (!currentMatch || drew) return;
    setDrew(true);
    sendAction(currentMatch.matchId, "draw");
  };

  const bgColor =
    phase === "draw" ? "bg-green-500/20 border-green-500/40" :
    phase === "decoy" ? "bg-orange-500/10 border-orange-500/20" :
    phase === "waiting" ? "bg-yellow-500/10 border-yellow-500/20" :
    "bg-black/20 border-white/5";

  return (
    <PvPGameShell gameType="quickdraw" emoji="🔫" title="Quick Draw">
      {({ myId, opponent }) => {
        const latest = rounds[rounds.length - 1];
        const result = latest?.result;
        const isP1 = myId < opponent.userId;
        return (
          <div className="space-y-6">
            <motion.div
              key={phase}
              animate={{ opacity: 1 }}
              initial={{ opacity: 0 }}
              className={`border rounded-2xl p-12 text-center space-y-4 cursor-pointer select-none transition-colors ${bgColor}`}
              onClick={phase === "draw" ? handleDraw : undefined}
            >
              {phase === "idle" && <div className="space-y-3"><div className="text-6xl">🔫</div><p className="text-muted-foreground">Get ready! Draw when you see the signal — but DON'T draw on the decoy!</p></div>}
              {phase === "waiting" && (
                <div className="space-y-3">
                  <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-6xl">⏳</motion.div>
                  <p className="text-yellow-400 font-semibold text-xl">Holster your hand...</p>
                </div>
              )}
              {phase === "decoy" && (
                <div className="space-y-3">
                  <div className="text-6xl">⚠️</div>
                  <p className="text-orange-400 font-black text-2xl">DECOY! Don't draw!</p>
                  <p className="text-sm text-muted-foreground">Wait for the real signal</p>
                </div>
              )}
              {phase === "draw" && !drew && (
                <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="space-y-3">
                  <div className="text-7xl">🟢</div>
                  <p className="text-green-400 font-black text-3xl">DRAW!</p>
                  <p className="text-sm text-muted-foreground">Click now!</p>
                </motion.div>
              )}
              {phase === "draw" && drew && <div className="space-y-3"><div className="text-6xl">🔫</div><p className="text-green-400 font-semibold">Drew! Waiting for {opponent.username}...</p></div>}
              {phase === "result" && result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="flex justify-center gap-8 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground">You</p>
                      <p className="font-bold text-white text-lg">{(isP1 ? result.p1Draw : result.p2Draw) === "early" ? "⚠️ Decoy!" : "Drew"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">{opponent.username}</p>
                      <p className="font-bold text-white text-lg">{(isP1 ? result.p2Draw : result.p1Draw) === "early" ? "⚠️ Decoy!" : "Drew"}</p>
                    </div>
                  </div>
                  <p className={`font-semibold text-lg ${result.winnerId === myId ? "text-green-400" : result.winnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                    {result.winnerId === myId ? "✅ Faster draw!" : result.winnerId === null ? "🤝 Draw!" : "❌ Too slow"}
                  </p>
                </motion.div>
              )}
            </motion.div>
            {phase === "draw" && (
              <Button onClick={handleDraw} disabled={drew} className="w-full h-16 text-xl font-black bg-green-600 hover:bg-green-500">
                🔫 DRAW!
              </Button>
            )}
            {rounds.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Round History</p>
                {rounds.slice().reverse().map((r, i) => (
                  <div key={i} className="flex justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                    <span className="text-muted-foreground">R{r.round}</span>
                    <span className={r.result?.winnerId === myId ? "text-emerald-400" : r.result?.winnerId === null ? "text-yellow-400" : "text-red-400"}>
                      {r.result?.winnerId === myId ? "Win" : r.result?.winnerId === null ? "Tie" : "Loss"}
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
