import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

type RPSChoice = "rock" | "paper" | "scissors";
const CHOICES: { id: RPSChoice; emoji: string; label: string }[] = [
  { id: "rock", emoji: "🪨", label: "Rock" },
  { id: "paper", emoji: "📄", label: "Paper" },
  { id: "scissors", emoji: "✂️", label: "Scissors" },
];

export default function RPSPvP() {
  const { currentMatch, lastRound, sendAction } = useMultiplayer();
  const [picked, setPicked] = useState<RPSChoice | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "rps") {
      setRounds(prev => [...prev, lastRound]);
      setPicked(null);
      setWaiting(false);
    }
  }, [lastRound]);

  const handlePick = (choice: RPSChoice) => {
    if (picked || !currentMatch) return;
    setPicked(choice);
    setWaiting(true);
    sendAction(currentMatch.matchId, "pick", { choice });
  };

  return (
    <PvPGameShell gameType="rps" emoji="✂️" title="Rock Paper Scissors">
      {({ myId, opponent }) => {
        const latestRound = rounds[rounds.length - 1];
        const result = latestRound?.result;
        const isP1 = myId < opponent.userId;

        const myChoice = result ? (isP1 ? result.p1Choice : result.p2Choice) : null;
        const oppChoice = result ? (isP1 ? result.p2Choice : result.p1Choice) : null;
        const myEmoji = myChoice ? CHOICES.find(c => c.id === myChoice)?.emoji : null;
        const oppEmoji = oppChoice ? CHOICES.find(c => c.id === oppChoice)?.emoji : null;

        return (
          <div className="space-y-6">
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 text-center">
              {result ? (
                <motion.div key={rounds.length} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex justify-center items-center gap-8 text-6xl">
                    <span>{myEmoji}</span>
                    <span className="text-2xl font-bold text-muted-foreground">vs</span>
                    <span>{oppEmoji}</span>
                  </div>
                  <p className={`font-semibold text-lg ${result.roundWinnerId === myId ? "text-green-400" : result.roundWinnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                    {result.roundWinnerId === myId ? "✅ Round Win!" : result.roundWinnerId === null ? "🤝 Tie!" : "❌ Round Loss"}
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  <div className="text-6xl">{picked ? CHOICES.find(c => c.id === picked)?.emoji : "❓"}</div>
                  <p className="text-muted-foreground">{waiting ? "Waiting for opponent..." : "Make your move"}</p>
                </div>
              )}
            </div>

            {!waiting && (
              <div className="grid grid-cols-3 gap-3">
                {CHOICES.map(c => (
                  <Button
                    key={c.id}
                    onClick={() => handlePick(c.id)}
                    className="h-20 flex flex-col gap-1"
                    variant={picked === c.id ? "default" : "outline"}
                  >
                    <span className="text-2xl">{c.emoji}</span>
                    <span className="text-xs">{c.label}</span>
                  </Button>
                ))}
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
                  const res = r.result;
                  const myC = isP1 ? res.p1Choice : res.p2Choice;
                  const oppC = isP1 ? res.p2Choice : res.p1Choice;
                  return (
                    <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                      <span className="text-muted-foreground">R{r.round}</span>
                      <span>{CHOICES.find(c => c.id === myC)?.emoji} vs {CHOICES.find(c => c.id === oppC)?.emoji}</span>
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
