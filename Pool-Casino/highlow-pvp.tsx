import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useGetMe } from "@workspace/api-client-react";
import { ArrowUp, ArrowDown } from "lucide-react";

interface HLRoundResult {
  firstRoll: number;
  secondRoll: number;
  p1Guess: string;
  p2Guess: string;
  actual: string;
  winnerId: number | null;
}

export default function HighLowPvP() {
  const { data: me } = useGetMe({ query: { retry: false } });
  const { currentMatch, lastRound, matchEnd, sendAction, hlFirstRoll, forfeitMatch, clearMatchEnd } = useMultiplayer();
  const [, navigate] = useLocation();
  const [rounds, setRounds] = useState<any[]>([]);
  const [myGuess, setMyGuess] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [phase, setPhase] = useState<"idle" | "rolling" | "guessing" | "result">("idle");

  useEffect(() => {
    if (!currentMatch || currentMatch.gameType !== "highlow") {
      navigate("/multiplayer");
    }
  }, [currentMatch?.gameType]);

  useEffect(() => {
    if (hlFirstRoll !== null) {
      setPhase("guessing");
      setMyGuess(null);
      setWaiting(false);
    }
  }, [hlFirstRoll]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "highlow") {
      setRounds(prev => [...prev, lastRound]);
      setPhase("result");
      setMyGuess(null);
      setWaiting(false);
    }
  }, [lastRound]);

  useEffect(() => {
    if (matchEnd) setShowEnd(true);
  }, [matchEnd]);

  if (!currentMatch || !me) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="text-4xl animate-bounce">🎲</div>
        <p className="text-muted-foreground">Loading match...</p>
      </div>
    </div>
  );

  const myId = me.id;
  const opponent = currentMatch.opponent;
  const scores = currentMatch.scores;
  const myScore = scores[myId] ?? 0;
  const oppScore = scores[opponent.userId] ?? 0;
  const isPlayer1 = myId < opponent.userId;
  const latestRound = rounds[rounds.length - 1];
  const latestResult = latestRound?.result as HLRoundResult | undefined;

  const handleReveal = () => {
    setPhase("rolling");
    sendAction(currentMatch.matchId, "reveal");
  };

  const handleGuess = (guess: "higher" | "lower") => {
    setMyGuess(guess);
    setWaiting(true);
    sendAction(currentMatch.matchId, "guess", { guess });
  };

  const DieDisplay = ({ value, label }: { value?: number; label: string }) => (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <motion.div
        key={value ?? "empty"}
        initial={{ scale: 0.8, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black border-2 shadow-lg ${
          value ? "bg-card border-white/20" : "bg-black/20 border-white/5"
        }`}
      >
        {value ?? <span className="opacity-20">?</span>}
      </motion.div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          🎲 Higher or Lower <span className="text-muted-foreground text-sm font-normal">PvP</span>
        </h1>
        <p className="text-muted-foreground text-sm">Bet: {formatCurrency(currentMatch.finalBet)} · Best of {currentMatch.totalRounds}</p>
      </div>

      {/* Score */}
      <div className="grid grid-cols-3 gap-4 items-center">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1 truncate">{me.username}</p>
          <div className="text-4xl font-black text-primary">{myScore}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Round {Math.min(rounds.length + 1, currentMatch.totalRounds)} of {currentMatch.totalRounds}</div>
          <div className="text-xl font-bold text-white mt-1">VS</div>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1 truncate">{opponent.username}</p>
          <div className="text-4xl font-black text-red-400">{oppScore}</div>
        </div>
      </div>

      {/* Dice area */}
      <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-end justify-around">
          <DieDisplay value={hlFirstRoll ?? latestResult?.firstRoll} label="First Roll" />
          <div className="text-2xl font-black text-muted-foreground">→</div>
          <DieDisplay value={phase === "result" ? latestResult?.secondRoll : undefined} label="Second Roll" />
        </div>

        {phase === "guessing" && hlFirstRoll && (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Will the next roll be higher or lower?</p>
            {!myGuess ? (
              <div className="flex gap-4 justify-center">
                <Button variant="outline" className="gap-2 border-green-500/40 hover:bg-green-500/10 hover:text-green-400"
                  onClick={() => handleGuess("higher")}>
                  <ArrowUp className="w-4 h-4" /> Higher
                </Button>
                <Button variant="outline" className="gap-2 border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                  onClick={() => handleGuess("lower")}>
                  <ArrowDown className="w-4 h-4" /> Lower
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-yellow-400">
                <span className="animate-pulse">⏳</span>
                You guessed <span className="font-semibold capitalize">{myGuess}</span> — waiting for opponent...
              </div>
            )}
          </div>
        )}

        {phase === "result" && latestResult && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
            <div className="text-sm text-muted-foreground">
              Roll was <span className="font-semibold text-white capitalize">{latestResult.actual}</span>
            </div>
            {latestResult.winnerId === null ? (
              <span className="text-yellow-400 font-semibold">🤝 No Winner This Round</span>
            ) : latestResult.winnerId === myId ? (
              <span className="text-green-400 font-semibold">✅ You Win This Round!</span>
            ) : (
              <span className="text-red-400 font-semibold">❌ Opponent Wins This Round</span>
            )}
          </motion.div>
        )}
      </div>

      {/* Next round button */}
      {(phase === "idle" || phase === "result") && rounds.length < currentMatch.totalRounds && (
        <Button onClick={handleReveal} disabled={phase === "rolling"}
          className="w-full h-12 text-base font-semibold shadow-[0_0_20px_rgba(0,255,170,0.3)]">
          🎲 {rounds.length === 0 ? "Roll First Dice" : "Next Round"}
        </Button>
      )}

      {/* Round history */}
      {rounds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Round History</p>
          {rounds.slice().reverse().map((r, i) => {
            const res = r.result as HLRoundResult;
            const myGuessVal = isPlayer1 ? res.p1Guess : res.p2Guess;
            return (
              <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                <span className="text-muted-foreground">Round {r.round}</span>
                <span>{res.firstRoll} → {res.secondRoll}</span>
                <span className="capitalize text-muted-foreground">{res.actual}</span>
                <span className="capitalize">{myGuessVal}</span>
                <span className={res.winnerId === myId ? "text-green-400" : res.winnerId === null ? "text-yellow-400" : "text-red-400"}>
                  {res.winnerId === myId ? "Win" : res.winnerId === null ? "Tie" : "Loss"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => forfeitMatch(currentMatch.matchId)}
        className="w-full text-xs text-muted-foreground hover:text-red-400 transition-colors py-2">
        Forfeit Match
      </button>

      <AnimatePresence>
        {showEnd && matchEnd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className={`bg-card border rounded-2xl p-8 w-full max-w-sm text-center space-y-4 shadow-2xl ${
                matchEnd.youWon ? "border-green-500/40" : "border-red-500/40"
              }`}>
              <div className="text-6xl">{matchEnd.youWon ? "🏆" : "💀"}</div>
              <h2 className="text-2xl font-black text-white">{matchEnd.youWon ? "Victory!" : "Defeat"}</h2>
              <p className="text-muted-foreground">
                {matchEnd.youWon ? `You won ${formatCurrency(matchEnd.finalBet)}!`
                  : matchEnd.winnerId === null ? "It's a draw!"
                  : `You lost ${formatCurrency(matchEnd.finalBet)}`}
              </p>
              <Button className="w-full" onClick={() => { setShowEnd(false); clearMatchEnd(); navigate("/multiplayer"); }}>
                Back to Lobby
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
