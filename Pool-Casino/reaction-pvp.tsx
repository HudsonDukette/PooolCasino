import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

type Phase = "idle" | "waiting" | "go" | "result";

export default function ReactionPvP() {
  const { currentMatch, lastRound, pvpEvent, sendAction } = useMultiplayer();
  const [phase, setPhase] = useState<Phase>("idle");
  const [rounds, setRounds] = useState<any[]>([]);
  const [reacted, setReacted] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pvpEvent || currentMatch?.gameType !== "reaction") return;
    if (pvpEvent.event === "reaction:waiting") {
      setPhase("waiting");
      setReacted(false);
      startTimeRef.current = null;
    }
    if (pvpEvent.event === "reaction:go") {
      setPhase("go");
      startTimeRef.current = Date.now();
    }
  }, [pvpEvent]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "reaction") {
      setRounds(prev => [...prev, lastRound]);
      setPhase("result");
      setReacted(false);
    }
  }, [lastRound]);

  const handleReact = () => {
    if (!currentMatch || reacted) return;
    setReacted(true);
    sendAction(currentMatch.matchId, "react");
  };

  const bgColor =
    phase === "go" ? "bg-green-500/20 border-green-500/40" :
    phase === "waiting" ? "bg-yellow-500/10 border-yellow-500/20" :
    "bg-black/20 border-white/5";

  return (
    <PvPGameShell gameType="reaction" emoji="⚡" title="Reaction Time">
      {({ myId, opponent }) => {
        const latestRound = rounds[rounds.length - 1];
        const result = latestRound?.result;
        const isP1 = myId < opponent.userId;

        return (
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={phase}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`border rounded-2xl p-12 text-center space-y-4 cursor-pointer select-none transition-colors ${bgColor}`}
                onClick={phase === "go" ? handleReact : undefined}
              >
                {phase === "idle" && (
                  <div className="space-y-3">
                    <div className="text-6xl">⚡</div>
                    <p className="text-muted-foreground">Get ready! The signal will appear soon...</p>
                  </div>
                )}
                {phase === "waiting" && (
                  <div className="space-y-3">
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="text-6xl"
                    >
                      🔴
                    </motion.div>
                    <p className="text-yellow-400 font-semibold text-xl">Wait for it...</p>
                    <p className="text-sm text-muted-foreground">DON'T click yet!</p>
                  </div>
                )}
                {phase === "go" && !reacted && (
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="space-y-3"
                  >
                    <div className="text-7xl">🟢</div>
                    <p className="text-green-400 font-black text-3xl">TAP NOW!</p>
                    <p className="text-sm text-muted-foreground">Click anywhere!</p>
                  </motion.div>
                )}
                {phase === "go" && reacted && (
                  <div className="space-y-3">
                    <div className="text-6xl">✅</div>
                    <p className="text-green-400 font-semibold text-xl">Reacted! Waiting for {opponent.username}...</p>
                  </div>
                )}
                {phase === "result" && result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex justify-center gap-8 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground">You</p>
                        <p className="font-bold text-white text-lg">
                          {(isP1 ? result.p1Reaction : result.p2Reaction) === "early"
                            ? "⚠️ Early!"
                            : typeof (isP1 ? result.p1Reaction : result.p2Reaction) === "number"
                            ? "Reacted"
                            : "Too slow"}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">{opponent.username}</p>
                        <p className="font-bold text-white text-lg">
                          {(isP1 ? result.p2Reaction : result.p1Reaction) === "early"
                            ? "⚠️ Early!"
                            : typeof (isP1 ? result.p2Reaction : result.p1Reaction) === "number"
                            ? "Reacted"
                            : "Too slow"}
                        </p>
                      </div>
                    </div>
                    <p className={`font-semibold text-lg ${result.winnerId === myId ? "text-green-400" : result.winnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                      {result.winnerId === myId ? "✅ Faster!" : result.winnerId === null ? "🤝 Tie!" : "❌ Opponent faster"}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {phase === "go" && (
              <Button onClick={handleReact} disabled={reacted} className="w-full h-16 text-xl font-black bg-green-600 hover:bg-green-500">
                ⚡ REACT!
              </Button>
            )}

            {rounds.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Round History</p>
                {rounds.slice().reverse().map((r, i) => {
                  const res = r.result;
                  return (
                    <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                      <span className="text-muted-foreground">R{r.round}</span>
                      <span className={res.winnerId === myId ? "text-green-400" : res.winnerId === null ? "text-yellow-400" : "text-red-400"}>
                        {res.winnerId === myId ? "Win" : res.winnerId === null ? "Tie" : "Loss"}
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
