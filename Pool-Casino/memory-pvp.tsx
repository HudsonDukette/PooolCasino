import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import PvPGameShell from "@/components/PvPGameShell";

const PAIR_EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑", "🫐", "🍉"];

export default function MemoryPvP() {
  const { currentMatch, lastRound, pvpEvent, sendAction } = useMultiplayer();
  const [matched, setMatched] = useState<boolean[]>(Array(16).fill(false));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [gridValues, setGridValues] = useState<string[]>([]);
  const [myTurn, setMyTurn] = useState(false);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [waitingFlip, setWaitingFlip] = useState(false);

  useEffect(() => {
    if (!currentMatch || currentMatch.gameType !== "memory") return;
    if (pvpEvent?.event === "memory:start") {
      const size = pvpEvent.data.gridSize ?? 16;
      setGridValues([]);
      setMatched(Array(size).fill(false));
      setFlipped([]);
    }
  }, [pvpEvent, currentMatch]);

  useEffect(() => {
    if (!lastRound || currentMatch?.gameType !== "memory") return;
    const result = lastRound.result;
    setMatched(result.matched ?? matched);
    setScores(result.scores ?? scores);

    if (result.isMatch) {
      setFlipped([]);
    } else {
      setTimeout(() => setFlipped([]), 1000);
    }

    if (result.flipped) setFlipped(result.flipped);
    setWaitingFlip(false);

    if (currentMatch && result.turn !== null) {
      const myId = currentMatch.scores ? Object.keys(currentMatch.scores).map(Number).find(id => id !== currentMatch.opponent.userId) : null;
      setMyTurn(result.turn === myId);
    }
  }, [lastRound]);

  const handleFlip = (index: number, myId: number) => {
    if (!myTurn || !currentMatch || waitingFlip) return;
    if (matched[index] || flipped.includes(index)) return;
    if (flipped.length >= 2) return;
    setWaitingFlip(true);
    sendAction(currentMatch.matchId, "flip", { index });
  };

  return (
    <PvPGameShell gameType="memory" emoji="🧠" title="Memory Match" roundLabel={(r) => `${r} pairs found`}>
      {({ myId, opponent }) => {
        return (
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              {myTurn ? "Your turn! Find matching pairs." : `${opponent.username}'s turn...`}
            </p>

            <div className="grid grid-cols-4 gap-2">
              {Array(16).fill(0).map((_, i) => {
                const isMatched = matched[i];
                const isFlipped = flipped.includes(i);
                const roundResult = lastRound?.result;
                const cardValue = roundResult?.flipped?.includes(i) && roundResult?.matched ? null : null;
                const pairIdx = roundResult && (isFlipped || isMatched) && roundResult.flipped?.includes(i)
                  ? parseInt(lastRound!.result.flipped ? "0" : "0")
                  : null;

                return (
                  <motion.button
                    key={i}
                    onClick={() => handleFlip(i, myId)}
                    disabled={!myTurn || isMatched || isFlipped || !currentMatch || waitingFlip}
                    whileTap={myTurn && !isMatched && !isFlipped ? { scale: 0.9 } : undefined}
                    className={`aspect-square rounded-xl text-2xl font-black transition-all border-2 ${
                      isMatched
                        ? "bg-green-500/20 border-green-500/40 text-green-400"
                        : isFlipped
                        ? "bg-primary/20 border-primary/40 text-white"
                        : myTurn
                        ? "bg-black/30 border-white/10 text-transparent hover:border-primary/40 cursor-pointer"
                        : "bg-black/30 border-white/5 text-transparent cursor-not-allowed"
                    }`}
                  >
                    {isMatched || isFlipped ? "🃏" : ""}
                  </motion.button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 border border-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">You</p>
                <p className="text-2xl font-black text-primary">{scores[myId] ?? 0} pairs</p>
              </div>
              <div className="bg-black/20 border border-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{opponent.username}</p>
                <p className="text-2xl font-black text-red-400">{scores[opponent.userId] ?? 0} pairs</p>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Turn-based · Matching pair = extra turn · Most pairs wins
            </p>
          </div>
        );
      }}
    </PvPGameShell>
  );
}
