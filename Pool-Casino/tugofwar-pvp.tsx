import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

export default function TugOfWarPvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [bar, setBar] = useState(50);
  const [tapping, setTapping] = useState(false);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "tugofwar") {
      setBar(lastRound.result.bar ?? 50);
      setTapping(false);
    }
  }, [lastRound]);

  const handleTap = () => {
    if (!currentMatch || tapping) return;
    setTapping(true);
    sendAction(currentMatch.matchId, "tap");
    setTimeout(() => setTapping(false), 200);
  };

  return (
    <PvPGameShell gameType="tugofwar" emoji="🪢" title="Tug of War" roundLabel={(r, t) => `Tap ${r} of max ${t}`}>
      {({ myId, opponent }) => {
        const isP1 = myId < opponent.userId;
        const myLabel = isP1 ? "You ← push" : "push → You";
        const latestResult = lastRound?.result;
        const lastTapper = latestResult?.tapperId;
        const gameDone = latestResult?.gameDone;

        return (
          <div className="space-y-6">
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 space-y-6">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>🔵 {isP1 ? "You" : opponent.username}</span>
                <span>{isP1 ? opponent.username : "You"} 🔴</span>
              </div>

              <div className="relative h-8 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <motion.div
                  animate={{ width: `${bar}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {bar}%
                </div>
                <motion.div
                  animate={{ left: `${bar}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-2xl"
                  style={{ left: `${bar}%` }}
                >
                  🪢
                </motion.div>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                {gameDone ? (
                  <p className="text-white font-semibold">Game over!</p>
                ) : lastTapper ? (
                  <p>{lastTapper === myId ? "You tapped!" : `${opponent.username} tapped!`}</p>
                ) : (
                  <p>Push the rope to your side! First to reach the edge wins.</p>
                )}
              </div>
            </div>

            {!gameDone && (
              <Button
                onClick={handleTap}
                disabled={tapping}
                className="w-full h-20 text-2xl font-black shadow-[0_0_30px_rgba(59,130,246,0.4)]"
              >
                {isP1 ? "← TAP" : "TAP →"}
              </Button>
            )}
          </div>
        );
      }}
    </PvPGameShell>
  );
}
