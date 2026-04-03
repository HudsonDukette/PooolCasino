import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

export default function LastManPvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [decided, setDecided] = useState<"stay" | "fold" | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "lastman") {
      setRounds(prev => [...prev, lastRound]);
      setDecided(null);
      setWaiting(false);
    }
  }, [lastRound]);

  const handleDecide = (decision: "stay" | "fold") => {
    if (decided || !currentMatch) return;
    setDecided(decision);
    setWaiting(true);
    sendAction(currentMatch.matchId, decision);
  };

  const RISK_LABELS = ["20%", "35%", "50%", "65%", "80%"];

  return (
    <PvPGameShell gameType="lastman" emoji="💀" title="Last Man Standing">
      {({ myId, opponent, currentRound, totalRounds }) => {
        const latestRound = rounds[rounds.length - 1];
        const result = latestRound?.result;
        const roundNum = Math.min(currentRound + 1, totalRounds);
        const riskLabel = RISK_LABELS[Math.min(roundNum - 1, 4)];
        const isP1 = myId < opponent.userId;

        return (
          <div className="space-y-6">
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Round {roundNum} of {totalRounds}</p>
                <div className="text-5xl font-black text-red-400">{riskLabel}</div>
                <p className="text-sm text-muted-foreground">chance of elimination</p>
              </div>

              {result ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="flex justify-center gap-8 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground">You</p>
                      <p className={`font-bold text-lg capitalize ${(isP1 ? result.p1Decision : result.p2Decision) === "fold" ? "text-red-400" : "text-green-400"}`}>
                        {isP1 ? result.p1Decision : result.p2Decision}
                      </p>
                      {result.p1Failed !== undefined && (isP1 ? result.p1Failed : result.p2Failed) && (
                        <p className="text-xs text-red-400">💥 Eliminated!</p>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">{opponent.username}</p>
                      <p className={`font-bold text-lg capitalize ${(isP1 ? result.p2Decision : result.p1Decision) === "fold" ? "text-red-400" : "text-green-400"}`}>
                        {isP1 ? result.p2Decision : result.p1Decision}
                      </p>
                      {result.p2Failed !== undefined && (isP1 ? result.p2Failed : result.p1Failed) && (
                        <p className="text-xs text-red-400">💥 Eliminated!</p>
                      )}
                    </div>
                  </div>
                  {result.riskChance && (
                    <p className="text-xs text-muted-foreground">
                      Risk roll: You {(isP1 ? result.p1Roll : result.p2Roll) !== undefined ? Math.round((isP1 ? result.p1Roll : result.p2Roll) * 100) + "%" : "—"} / Opp {(isP1 ? result.p2Roll : result.p1Roll) !== undefined ? Math.round((isP1 ? result.p2Roll : result.p1Roll) * 100) + "%" : "—"}
                    </p>
                  )}
                </motion.div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {waiting ? "Waiting for opponent..." : "Stay in or fold?"}
                </p>
              )}
            </div>

            {!waiting && (
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleDecide("stay")}
                  className="h-16 text-lg bg-green-600 hover:bg-green-500"
                >
                  🎰 Stay In
                </Button>
                <Button
                  onClick={() => handleDecide("fold")}
                  variant="destructive"
                  className="h-16 text-lg"
                >
                  🏳️ Fold
                </Button>
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
                      <span className="capitalize text-xs">{isP1 ? res.p1Decision : res.p2Decision} / {isP1 ? res.p2Decision : res.p1Decision}</span>
                      <span className={res.roundWinnerId === myId ? "text-green-400" : res.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}>
                        {res.roundWinnerId === myId ? "Survived" : res.roundWinnerId === null ? "Tie" : "Eliminated"}
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
