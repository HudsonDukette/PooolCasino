import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

export default function SpeedClickPvP() {
  const { currentMatch, lastRound, pvpEvent, sendAction } = useMultiplayer();
  const [phase, setPhase] = useState<"waiting" | "active" | "done">("waiting");
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [result, setResult] = useState<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pvpEvent?.event === "speedclick:start" && currentMatch?.gameType === "speedclick") {
      const durationMs = pvpEvent.data.durationMs ?? 5000;
      setPhase("active");
      setClicks(0);
      setTimeLeft(Math.ceil(durationMs / 1000));

      const end = Date.now() + durationMs;
      const interval = setInterval(() => {
        const remaining = Math.ceil((end - Date.now()) / 1000);
        setTimeLeft(Math.max(0, remaining));
        if (remaining <= 0) clearInterval(interval);
      }, 100);

      timerRef.current = interval as any;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pvpEvent]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "speedclick") {
      setPhase("done");
      setResult(lastRound.result);
    }
  }, [lastRound]);

  const handleClick = () => {
    if (phase !== "active" || !currentMatch) return;
    setClicks(c => c + 1);
    sendAction(currentMatch.matchId, "click");
  };

  return (
    <PvPGameShell gameType="speedclick" emoji="👆" title="Speed Click" roundLabel={() => "5 Second Sprint"}>
      {({ myId, opponent }) => {
        const isP1 = myId < opponent.userId;
        const myClicks = result ? (isP1 ? result.p1Clicks : result.p2Clicks) : null;
        const oppClicks = result ? (isP1 ? result.p2Clicks : result.p1Clicks) : null;

        return (
          <div className="space-y-6">
            {phase === "waiting" && (
              <div className="bg-black/20 border border-white/5 rounded-2xl p-12 text-center space-y-4">
                <div className="text-6xl animate-pulse">👆</div>
                <p className="text-xl text-white font-semibold">Get ready!</p>
                <p className="text-muted-foreground">Click as fast as you can when the timer starts. Max 15 clicks/second.</p>
              </div>
            )}

            {phase === "active" && (
              <div className="space-y-4">
                <div className="bg-black/20 border border-white/5 rounded-2xl p-6 text-center">
                  <div className={`text-6xl font-black mb-2 ${timeLeft <= 2 ? "text-red-400" : "text-primary"}`}>
                    {timeLeft}s
                  </div>
                  <p className="text-muted-foreground text-sm">seconds left</p>
                </div>

                <motion.button
                  onClick={handleClick}
                  whileTap={{ scale: 0.92 }}
                  className="w-full h-40 rounded-2xl bg-primary font-black text-2xl text-black select-none cursor-pointer flex flex-col items-center justify-center gap-2 shadow-[0_0_40px_rgba(0,255,170,0.5)]"
                >
                  <span className="text-5xl">👆</span>
                  <span>CLICK! ({clicks})</span>
                </motion.button>
              </div>
            )}

            {phase === "done" && result && (
              <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center space-y-6">
                <p className="text-muted-foreground text-sm">Time's up!</p>
                <div className="flex justify-center gap-12">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">You</p>
                    <p className="text-5xl font-black text-primary">{myClicks}</p>
                    <p className="text-xs text-muted-foreground">clicks</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">{opponent.username}</p>
                    <p className="text-5xl font-black text-red-400">{oppClicks}</p>
                    <p className="text-xs text-muted-foreground">clicks</p>
                  </div>
                </div>
                <p className={`font-semibold text-lg ${result.winnerId === myId ? "text-green-400" : result.winnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                  {result.winnerId === myId ? "✅ You clicked faster!" : result.winnerId === null ? "🤝 Tie!" : "❌ Opponent clicked more"}
                </p>
              </div>
            )}
          </div>
        );
      }}
    </PvPGameShell>
  );
}
