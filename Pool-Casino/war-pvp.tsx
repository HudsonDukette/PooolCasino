import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useGetMe } from "@workspace/api-client-react";

interface Card {
  value: number;
  suit: string;
  label: string;
}

interface RoundResult {
  player1Card: Card;
  player2Card: Card;
  winnerId: number | null;
}

interface RoundData {
  round: number;
  total: number;
  result: RoundResult;
  scores: Record<number, number>;
}

export default function WarPvP() {
  const { data: me } = useGetMe({ query: { retry: false } });
  const { currentMatch, lastRound, matchEnd, sendAction, forfeitMatch, clearMatchEnd } = useMultiplayer();
  const [, navigate] = useLocation();
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  useEffect(() => {
    if (!currentMatch || currentMatch.gameType !== "war") {
      navigate("/multiplayer");
    }
  }, [currentMatch?.gameType]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "war") {
      setRounds(prev => [...prev, lastRound as RoundData]);
      setDrawing(false);
    }
  }, [lastRound]);

  useEffect(() => {
    if (matchEnd) {
      setShowEnd(true);
    }
  }, [matchEnd]);

  if (!currentMatch || !me) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="text-4xl animate-bounce">🃏</div>
        <p className="text-muted-foreground">Loading match...</p>
      </div>
    </div>
  );

  const myId = me.id;
  const opponent = currentMatch.opponent;
  const scores = currentMatch.scores;
  const myScore = scores[myId] ?? 0;
  const oppScore = scores[opponent.userId] ?? 0;
  const latestRound = rounds[rounds.length - 1];
  const isPlayer1 = myId < opponent.userId;

  const handleDraw = () => {
    if (drawing) return;
    setDrawing(true);
    sendAction(currentMatch.matchId, "draw");
  };

  const suitColor = (suit: string) => ["♥", "♦"].includes(suit) ? "text-red-400" : "text-white";

  const CardDisplay = ({ card, label }: { card?: Card; label: string }) => (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <motion.div
        key={card ? `${card.label}${card.suit}` : "empty"}
        initial={{ rotateY: 90, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        className={`w-20 h-28 rounded-xl flex flex-col items-center justify-center text-2xl font-bold border-2 shadow-lg ${
          card ? "bg-card border-white/20" : "bg-black/20 border-white/5"
        }`}
      >
        {card ? (
          <>
            <span className={`text-3xl font-black ${suitColor(card.suit)}`}>{card.suit}</span>
            <span className={`text-lg font-bold ${suitColor(card.suit)}`}>{card.label}</span>
          </>
        ) : (
          <span className="text-4xl opacity-20">🃏</span>
        )}
      </motion.div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          🃏 War <span className="text-muted-foreground text-sm font-normal">PvP</span>
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

      {/* Cards */}
      <div className="bg-black/20 border border-white/5 rounded-2xl p-6">
        <div className="flex items-end justify-around">
          <CardDisplay
            card={latestRound ? (isPlayer1 ? latestRound.result.player1Card : latestRound.result.player2Card) : undefined}
            label="Your Card"
          />
          <div className="text-2xl font-black text-muted-foreground">VS</div>
          <CardDisplay
            card={latestRound ? (isPlayer1 ? latestRound.result.player2Card : latestRound.result.player1Card) : undefined}
            label={`${opponent.username}'s Card`}
          />
        </div>

        {latestRound && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center"
          >
            {latestRound.result.winnerId === null ? (
              <span className="text-yellow-400 font-semibold">🤝 It's a Tie!</span>
            ) : latestRound.result.winnerId === myId ? (
              <span className="text-green-400 font-semibold">✅ You Win This Round!</span>
            ) : (
              <span className="text-red-400 font-semibold">❌ Opponent Wins This Round</span>
            )}
          </motion.div>
        )}
      </div>

      {/* Action */}
      {rounds.length < currentMatch.totalRounds && (
        <Button
          onClick={handleDraw}
          disabled={drawing}
          className="w-full h-12 text-base font-semibold shadow-[0_0_20px_rgba(0,255,170,0.3)]"
        >
          {drawing ? "Drawing..." : rounds.length === 0 ? "🃏 Draw Card" : "🃏 Next Round"}
        </Button>
      )}

      {/* Round history */}
      {rounds.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Round History</p>
          {rounds.slice().reverse().map((r, i) => {
            const myCard = isPlayer1 ? r.result.player1Card : r.result.player2Card;
            const oppCard = isPlayer1 ? r.result.player2Card : r.result.player1Card;
            return (
              <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm">
                <span className="text-muted-foreground">Round {r.round}</span>
                <span className={suitColor(myCard.suit)}>{myCard.label}{myCard.suit}</span>
                <span>vs</span>
                <span className={suitColor(oppCard.suit)}>{oppCard.label}{oppCard.suit}</span>
                <span className={r.result.winnerId === myId ? "text-green-400" : r.result.winnerId === null ? "text-yellow-400" : "text-red-400"}>
                  {r.result.winnerId === myId ? "Win" : r.result.winnerId === null ? "Tie" : "Loss"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Forfeit */}
      <button
        onClick={() => forfeitMatch(currentMatch.matchId)}
        className="w-full text-xs text-muted-foreground hover:text-red-400 transition-colors py-2"
      >
        Forfeit Match
      </button>

      {/* End modal */}
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
              className={`bg-card border rounded-2xl p-8 w-full max-w-sm text-center space-y-4 shadow-2xl ${
                matchEnd.youWon ? "border-green-500/40" : "border-red-500/40"
              }`}
            >
              <div className="text-6xl">{matchEnd.youWon ? "🏆" : "💀"}</div>
              <h2 className="text-2xl font-black text-white">{matchEnd.youWon ? "Victory!" : "Defeat"}</h2>
              <p className="text-muted-foreground">
                {matchEnd.youWon
                  ? `You won ${formatCurrency(matchEnd.finalBet)}!`
                  : matchEnd.winnerId === null
                  ? "It's a draw — no chips exchanged."
                  : `You lost ${formatCurrency(matchEnd.finalBet)}`
                }
              </p>
              <div className="flex gap-2 text-sm text-muted-foreground justify-center">
                <span>You: {matchEnd.scores[myId] ?? 0}</span>
                <span>·</span>
                <span>{opponent.username}: {matchEnd.scores[opponent.userId] ?? 0}</span>
              </div>
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
