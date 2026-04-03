import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import PvPGameShell from "@/components/PvPGameShell";

const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];
const VALUE_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RED_SUITS = [1, 2];

function CardDisplay({ value, suitIdx }: { value: number; suitIdx: number }) {
  const label = VALUE_LABELS[value] ?? `${value}`;
  const suit = SUIT_SYMBOLS[suitIdx % 4];
  const isRed = RED_SUITS.includes(suitIdx % 4);
  return (
    <motion.div
      initial={{ rotateY: 90 }}
      animate={{ rotateY: 0 }}
      className={`w-14 h-20 rounded-xl border-2 border-white/20 bg-white flex flex-col items-center justify-center shadow-lg`}
    >
      <span className={`text-xl font-black ${isRed ? "text-red-500" : "text-gray-900"}`}>{label}</span>
      <span className={`text-lg ${isRed ? "text-red-500" : "text-gray-900"}`}>{suit}</span>
    </motion.div>
  );
}

export default function PokerPvP() {
  const { currentMatch, lastRound } = useMultiplayer();
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "poker") {
      setResult(lastRound.result);
    }
  }, [lastRound]);

  return (
    <PvPGameShell gameType="poker" emoji="♠️" title="5-Card Poker" roundLabel={() => "Showdown"}>
      {({ myId, opponent }) => {
        const isP1 = myId < opponent.userId;
        const myHand: number[] = result ? (isP1 ? result.p1Hand : result.p2Hand) : [];
        const oppHand: number[] = result ? (isP1 ? result.p2Hand : result.p1Hand) : [];
        const myEval = result ? (isP1 ? result.p1Eval : result.p2Eval) : null;
        const oppEval = result ? (isP1 ? result.p2Eval : result.p1Eval) : null;

        return (
          <div className="space-y-6">
            {!result ? (
              <div className="bg-black/20 border border-white/5 rounded-2xl p-12 text-center space-y-4">
                <div className="text-6xl animate-pulse">♠️</div>
                <p className="text-muted-foreground">Dealing cards...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-3">Your Hand</p>
                    <div className="flex justify-center gap-2">
                      {myHand.map((v, i) => (
                        <CardDisplay key={i} value={v} suitIdx={i} />
                      ))}
                    </div>
                    {myEval && (
                      <p className="mt-3 text-sm font-semibold text-primary">{myEval.name}</p>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-4 text-center">
                    <p className="text-xs text-muted-foreground mb-3">{opponent.username}'s Hand</p>
                    <div className="flex justify-center gap-2">
                      {oppHand.map((v, i) => (
                        <CardDisplay key={i} value={v} suitIdx={i + 2} />
                      ))}
                    </div>
                    {oppEval && (
                      <p className="mt-3 text-sm font-semibold text-muted-foreground">{oppEval.name}</p>
                    )}
                  </div>
                </div>

                <div className={`text-center py-4 rounded-2xl border ${result.winnerId === myId ? "bg-green-500/10 border-green-500/30" : result.winnerId === null ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                  <p className={`text-xl font-black ${result.winnerId === myId ? "text-green-400" : result.winnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                    {result.winnerId === myId ? "🏆 Better Hand!" : result.winnerId === null ? "🤝 It's a Tie!" : "💀 Opponent Wins"}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      }}
    </PvPGameShell>
  );
}
