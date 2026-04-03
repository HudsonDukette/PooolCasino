import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

export default function DiceBattlePvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [rolling, setRolling] = useState(false);
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "dicebattle") {
      setRounds(prev => [...prev, lastRound]);
      setRolling(false);
    }
  }, [lastRound]);

  const handleRoll = () => {
    if (rolling || !currentMatch) return;
    setRolling(true);
    sendAction(currentMatch.matchId, "roll");
  };

  const DieFace = ({ value }: { value: number }) => {
    const dots = Array(value).fill(0);
    return (
      <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg">
        <div className="grid grid-cols-3 gap-1 p-2">
          {[1,2,3,4,5,6,7,8,9].map(pos => {
            const show = (value === 1 && pos === 5) ||
              (value === 2 && (pos === 1 || pos === 9)) ||
              (value === 3 && (pos === 1 || pos === 5 || pos === 9)) ||
              (value === 4 && (pos === 1 || pos === 3 || pos === 7 || pos === 9)) ||
              (value === 5 && (pos === 1 || pos === 3 || pos === 5 || pos === 7 || pos === 9)) ||
              (value === 6 && (pos === 1 || pos === 3 || pos === 4 || pos === 6 || pos === 7 || pos === 9));
            return <div key={pos} className={`w-2 h-2 rounded-full ${show ? "bg-black" : ""}`} />;
          })}
        </div>
      </div>
    );
  };

  return (
    <PvPGameShell gameType="dicebattle" emoji="🎲" title="Dice Battle">
      {({ myId, opponent }) => {
        const latestRound = rounds[rounds.length - 1];
        const result = latestRound?.result;
        const isP1 = myId < opponent.userId;

        return (
          <div className="space-y-6">
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center">
              {result ? (
                <motion.div key={rounds.length} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="flex justify-center items-end gap-8">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-muted-foreground">You</p>
                      <div className="flex gap-2">
                        {(isP1 ? result.p1Dice : result.p2Dice).map((d: number, i: number) => <DieFace key={i} value={d} />)}
                      </div>
                      <p className="text-xl font-black text-white">{isP1 ? result.p1Total : result.p2Total}</p>
                    </div>
                    <div className="text-xl font-bold text-muted-foreground pb-6">vs</div>
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-muted-foreground">{opponent.username}</p>
                      <div className="flex gap-2">
                        {(isP1 ? result.p2Dice : result.p1Dice).map((d: number, i: number) => <DieFace key={i} value={d} />)}
                      </div>
                      <p className="text-xl font-black text-white">{isP1 ? result.p2Total : result.p1Total}</p>
                    </div>
                  </div>
                  <p className={`font-semibold text-lg ${result.roundWinnerId === myId ? "text-green-400" : result.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                    {result.roundWinnerId === myId ? "✅ Round Win!" : result.roundWinnerId === null ? "🤝 Tie!" : "❌ Round Loss"}
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  <div className="text-6xl">{rolling ? "🎲" : "🎲"}</div>
                  <p className="text-muted-foreground">{rolling ? "Rolling..." : "Roll the dice!"}</p>
                </div>
              )}
            </div>

            <Button onClick={handleRoll} disabled={rolling} className="w-full h-12 text-base font-semibold">
              {rolling ? "Rolling..." : "🎲 Roll Dice"}
            </Button>

            {rounds.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Round History</p>
                {rounds.slice().reverse().map((r, i) => {
                  const res = r.result;
                  return (
                    <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                      <span className="text-muted-foreground">R{r.round}</span>
                      <span>{isP1 ? res.p1Total : res.p2Total} vs {isP1 ? res.p2Total : res.p1Total}</span>
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
