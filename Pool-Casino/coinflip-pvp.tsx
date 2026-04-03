import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

interface RoundResult {
  flip: "heads" | "tails";
  p1Choice: string;
  p2Choice: string;
  p1Correct: boolean;
  p2Correct: boolean;
  roundWinnerId: number | null;
}

export default function CoinFlipPvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [picked, setPicked] = useState<"heads" | "tails" | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "coinflip") {
      setRounds(prev => [...prev, lastRound]);
      setPicked(null);
      setWaiting(false);
    }
  }, [lastRound]);

  const handlePick = (choice: "heads" | "tails") => {
    if (picked || !currentMatch) return;
    setPicked(choice);
    setWaiting(true);
    sendAction(currentMatch.matchId, "pick", { choice });
  };

  return (
    <PvPGameShell gameType="coinflip" emoji="🪙" title="Coin Flip">
      {({ myId, opponent }) => {
        const latestRound = rounds[rounds.length - 1];
        const result: RoundResult | undefined = latestRound?.result;
        const isP1 = myId < opponent.userId;

        return (
          <div className="space-y-6">
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center space-y-6">
              {result ? (
                <motion.div key={rounds.length} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className="space-y-4">
                  <div className="text-7xl">{result.flip === "heads" ? "👑" : "🦅"}</div>
                  <p className="text-2xl font-black text-white capitalize">{result.flip}!</p>
                  <div className="flex justify-center gap-8 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground">You chose</p>
                      <p className="font-bold text-white capitalize">{isP1 ? result.p1Choice : result.p2Choice}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">{opponent.username} chose</p>
                      <p className="font-bold text-white capitalize">{isP1 ? result.p2Choice : result.p1Choice}</p>
                    </div>
                  </div>
                  <p className={`font-semibold text-lg ${result.roundWinnerId === myId ? "text-green-400" : result.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                    {result.roundWinnerId === myId ? "✅ Round Win!" : result.roundWinnerId === null ? "🤝 Tie!" : "❌ Round Loss"}
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  <div className="text-6xl">{picked ? (picked === "heads" ? "👑" : "🦅") : "🪙"}</div>
                  <p className="text-muted-foreground">{waiting ? "Waiting for opponent..." : "Pick heads or tails"}</p>
                </div>
              )}
            </div>

            {!waiting && (
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handlePick("heads")}
                  className="h-16 text-lg"
                  variant={picked === "heads" ? "default" : "outline"}
                >
                  👑 Heads
                </Button>
                <Button
                  onClick={() => handlePick("tails")}
                  className="h-16 text-lg"
                  variant={picked === "tails" ? "default" : "outline"}
                >
                  🦅 Tails
                </Button>
              </div>
            )}

            {waiting && (
              <div className="text-center text-muted-foreground animate-pulse">
                Waiting for {opponent.username}...
              </div>
            )}

            {rounds.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Round History</p>
                {rounds.slice().reverse().map((r, i) => {
                  const res: RoundResult = r.result;
                  return (
                    <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                      <span className="text-muted-foreground">Round {r.round}</span>
                      <span className="capitalize">{res.flip}</span>
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
