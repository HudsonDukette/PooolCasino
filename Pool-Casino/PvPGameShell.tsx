import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useGetMe } from "@workspace/api-client-react";

interface PvPGameShellProps {
  gameType: string;
  emoji: string;
  title: string;
  children: (props: {
    myId: number;
    opponent: { userId: number; username: string };
    matchId: number;
    finalBet: number;
    scores: Record<number, number>;
    myScore: number;
    oppScore: number;
    currentRound: number;
    totalRounds: number;
  }) => React.ReactNode;
  roundLabel?: (round: number, total: number) => string;
}

export default function PvPGameShell({ gameType, emoji, title, children, roundLabel }: PvPGameShellProps) {
  const { data: me } = useGetMe({ query: { retry: false } });
  const { currentMatch, lastRound, matchEnd, forfeitMatch, clearMatchEnd } = useMultiplayer();
  const [, navigate] = useLocation();
  const [showEnd, setShowEnd] = useState(false);

  useEffect(() => {
    if (!currentMatch || currentMatch.gameType !== gameType) {
      navigate("/multiplayer");
    }
  }, [currentMatch?.gameType]);

  useEffect(() => {
    if (matchEnd) setShowEnd(true);
  }, [matchEnd]);

  if (!currentMatch || !me) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-bounce">{emoji}</div>
          <p className="text-muted-foreground">Loading match...</p>
        </div>
      </div>
    );
  }

  const myId = me.id;
  const opponent = currentMatch.opponent;
  const scores = currentMatch.scores;
  const myScore = scores[myId] ?? 0;
  const oppScore = scores[opponent.userId] ?? 0;
  const currentRound = lastRound?.round ?? 0;
  const totalRounds = currentMatch.totalRounds;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          {emoji} {title} <span className="text-muted-foreground text-sm font-normal">PvP</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          Bet: {formatCurrency(currentMatch.finalBet)} · Best of {totalRounds}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 items-center bg-black/20 border border-white/5 rounded-2xl p-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1 truncate">{me.username}</p>
          <div className="text-4xl font-black text-primary">{myScore}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            {roundLabel ? roundLabel(currentRound, totalRounds) : `Round ${Math.min(currentRound + 1, totalRounds)} of ${totalRounds}`}
          </div>
          <div className="text-xl font-bold text-white mt-1">VS</div>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1 truncate">{opponent.username}</p>
          <div className="text-4xl font-black text-red-400">{oppScore}</div>
        </div>
      </div>

      {children({ myId, opponent, matchId: currentMatch.matchId, finalBet: currentMatch.finalBet, scores, myScore, oppScore, currentRound, totalRounds })}

      <button
        onClick={() => forfeitMatch(currentMatch.matchId)}
        className="w-full text-xs text-muted-foreground hover:text-red-400 transition-colors py-2"
      >
        Forfeit Match
      </button>

      <AnimatePresence>
        {showEnd && matchEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className={`bg-card border rounded-2xl p-8 w-full max-w-sm text-center space-y-4 shadow-2xl ${matchEnd.youWon ? "border-green-500/40" : "border-red-500/40"}`}
            >
              <div className="text-6xl">{matchEnd.youWon ? "🏆" : "💀"}</div>
              <h2 className="text-2xl font-black text-white">{matchEnd.youWon ? "Victory!" : "Defeat"}</h2>
              <p className="text-muted-foreground">
                {matchEnd.youWon
                  ? `You won ${formatCurrency(matchEnd.finalBet)}!`
                  : matchEnd.winnerId === null
                  ? "It's a draw — no chips exchanged."
                  : `You lost ${formatCurrency(matchEnd.finalBet)}`}
              </p>
              <div className="flex gap-2 text-sm text-muted-foreground justify-center">
                <span>{me.username}: {matchEnd.scores[myId] ?? 0}</span>
                <span>·</span>
                <span>{opponent.username}: {matchEnd.scores[opponent.userId] ?? 0}</span>
              </div>
              {matchEnd.reason === "forfeit" && <p className="text-xs text-yellow-400">Match ended by forfeit</p>}
              {matchEnd.reason === "disconnect" && <p className="text-xs text-yellow-400">Opponent disconnected</p>}
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
