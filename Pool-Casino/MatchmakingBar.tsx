import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { X, Swords, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function MatchmakingBar() {
  const { queued, queueGameType, leaveQueue, matchFound, acceptMatch, placeBet, currentMatch, matchEnd, clearMatchEnd, connected } = useMultiplayer();
  const [, navigate] = useLocation();
  const [acceptTimer, setAcceptTimer] = useState(10);
  const [betInput, setBetInput] = useState("1000");
  const [betPlaced, setBetPlaced] = useState(false);

  useEffect(() => {
    if (!matchFound) { setAcceptTimer(10); setBetPlaced(false); return; }
    setAcceptTimer(matchFound.timeoutSeconds);
    const interval = setInterval(() => {
      setAcceptTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [matchFound?.matchId]);

  useEffect(() => {
    if (currentMatch) {
      navigate(`/multiplayer/${currentMatch.gameType}`);
    }
  }, [currentMatch?.matchId]);

  useEffect(() => {
    if (!matchEnd) return;
    const t = setTimeout(() => clearMatchEnd(), 5000);
    return () => clearTimeout(t);
  }, [matchEnd]);

  const handleAccept = () => {
    if (!matchFound) return;
    const bet = parseFloat(betInput) || 1000;
    placeBet(matchFound.matchId, bet);
    acceptMatch(matchFound.matchId);
    setBetPlaced(true);
  };

  return (
    <AnimatePresence>
      {/* Queued status */}
      {queued && !matchFound && (
        <motion.div
          key="queue"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-primary/30 rounded-2xl px-5 py-3 shadow-2xl backdrop-blur-xl"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-70"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
          </span>
          <span className="text-sm font-medium text-white">
            Searching for opponent in <span className="text-primary capitalize">{queueGameType}</span>...
          </span>
          <button onClick={leaveQueue} className="ml-2 text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Match found */}
      {matchFound && !betPlaced && (
        <motion.div
          key="found"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-card border border-primary/40 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="text-4xl">⚔️</div>
              <h2 className="text-xl font-bold text-white">Match Found!</h2>
              <p className="text-muted-foreground text-sm">
                vs <span className="text-primary font-semibold">{matchFound.opponent.username}</span> in{" "}
                <span className="capitalize font-medium text-white">{matchFound.gameType}</span>
              </p>
              <div className="flex items-center justify-center gap-1.5 text-yellow-400 text-sm font-medium">
                <Clock className="w-4 h-4" /> {acceptTimer}s to accept
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Your Bet</label>
              <div className="flex gap-2">
                {["500","1000","5000","10000"].map(v => (
                  <button key={v} onClick={() => setBetInput(v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${betInput === v ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
                    {formatCurrency(parseInt(v))}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={betInput}
                onChange={e => setBetInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                placeholder="Custom amount"
                min="1"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { clearMatchEnd(); }}>
                Decline
              </Button>
              <Button className="flex-1 shadow-[0_0_15px_rgba(0,255,170,0.3)]" onClick={handleAccept}>
                <Swords className="w-4 h-4 mr-2" /> Accept
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Waiting for opponent to accept */}
      {matchFound && betPlaced && (
        <motion.div
          key="waiting"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-yellow-500/30 rounded-2xl px-5 py-3 shadow-2xl"
        >
          <span className="animate-pulse text-yellow-400">⏳</span>
          <span className="text-sm font-medium text-white">Waiting for {matchFound.opponent.username}... ({acceptTimer}s)</span>
        </motion.div>
      )}

      {/* Match end toast */}
      {matchEnd && (
        <motion.div
          key="end"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-2xl ${
            matchEnd.youWon ? "bg-green-900/80 border border-green-500/40" : "bg-red-900/80 border border-red-500/40"
          }`}
        >
          <span className="text-xl">{matchEnd.youWon ? "🏆" : "💀"}</span>
          <span className="text-sm font-medium text-white">
            {matchEnd.youWon
              ? `You won ${formatCurrency(matchEnd.finalBet)}!`
              : `You lost ${formatCurrency(matchEnd.finalBet)}`
            }
          </span>
          <button onClick={clearMatchEnd} className="ml-2 text-muted-foreground hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
