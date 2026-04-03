import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import { useGameApi } from "@/lib/game-api";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

interface DealResult {
  playerCards: string[];
  dealerUpcard?: string;
  dealerCards?: string[];
  playerTotal: number;
  dealerTotal?: number;
  done: boolean;
  won?: boolean;
  payout?: number;
  multiplier?: number;
  newBalance?: number;
  outcome?: string;
}

interface ActionResult {
  playerCards: string[];
  dealerCards?: string[];
  playerTotal: number;
  dealerTotal?: number;
  done: boolean;
  won?: boolean;
  payout?: number;
  multiplier?: number;
  newBalance?: number;
  outcome?: string;
}

const SUITS = ["♠", "♣", "♥", "♦"];
function getSuit(index: number) {
  const suit = SUITS[index % SUITS.length];
  const isRed = suit === "♥" || suit === "♦";
  return { suit, isRed };
}

function PlayingCard({ label, hidden, index }: { label: string; hidden?: boolean; index: number }) {
  const { suit, isRed } = getSuit(index);

  return (
    <div style={{ perspective: "500px" }}>
      <motion.div
        initial={{ rotateY: -90, y: -20, opacity: 0 }}
        animate={{ rotateY: 0, y: 0, opacity: 1 }}
        transition={{
          delay: index * 0.12,
          type: "spring",
          stiffness: 220,
          damping: 20,
        }}
        className="w-16 h-24 rounded-xl shadow-xl"
        style={{ transformStyle: "preserve-3d" }}
      >
        {hidden ? (
          <div className="w-full h-full rounded-xl bg-gradient-to-br from-blue-800 to-blue-950 border border-white/20 flex items-center justify-center">
            <div className="w-10 h-16 rounded-lg border border-white/10 bg-gradient-to-br from-blue-700/50 to-blue-900/50 flex items-center justify-center text-2xl opacity-50">
              🂠
            </div>
          </div>
        ) : (
          <div className="w-full h-full rounded-xl bg-white border border-white/20 shadow-inner flex flex-col items-start justify-between p-1.5">
            <div className={`text-xs font-bold leading-none ${isRed ? "text-red-600" : "text-gray-900"}`}>
              <div>{label}</div>
              <div>{suit}</div>
            </div>
            <div className={`self-center text-2xl font-bold ${isRed ? "text-red-600" : "text-gray-900"}`}>
              {suit}
            </div>
            <div className={`self-end rotate-180 text-xs font-bold leading-none ${isRed ? "text-red-600" : "text-gray-900"}`}>
              <div>{label}</div>
              <div>{suit}</div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Hand({ cards, label, total, hidden }: { cards: string[]; label: string; total?: number | null; hidden?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{label}</p>
        {total !== null && total !== undefined && !hidden && (
          <motion.span
            key={total}
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
              total > 21 ? "bg-destructive/20 text-destructive" :
              total === 21 ? "bg-primary/20 text-primary" :
              "bg-white/10 text-white"
            }`}
          >
            {total}
          </motion.span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap min-h-[96px] items-start">
        {cards.map((c, i) => (
          <PlayingCard key={i} label={c} index={i} hidden={i === 1 && !!hidden} />
        ))}
      </div>
    </div>
  );
}

const OUTCOME_LABELS: Record<string, string> = {
  blackjack:        "🃏 Blackjack! (2.5×)",
  dealer_blackjack: "Dealer Blackjack",
  push:             "🤝 Push — bet returned",
  bust:             "💥 Bust!",
  dealer_bust:      "🎉 Dealer Busts!",
  win:              "🏆 You Win!",
  lose:             "You Lose",
};

export default function Blackjack() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const dealApi = useGameApi<DealResult>();
  const actionApi = useGameApi<ActionResult>();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState("10");
  const [gameState, setGameState] = useState<DealResult | null>(null);
  const [actionState, setActionState] = useState<ActionResult | null>(null);
  const [phase, setPhase] = useState<"bet" | "play" | "done">("bet");

  const bet = parseFloat(betAmount) || 0;
  const loading = dealApi.loading || actionApi.loading;

  async function handleDeal() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }

    setActionState(null);
    const data = await dealApi.call("blackjack/deal", { betAmount: bet, casinoId });
    if (!data) {
      toast({ title: "Bet failed", description: dealApi.error ?? "Something went wrong", variant: "destructive" });
      return;
    }
    if (data) {
      setGameState(data);
      if (data.done) {
        setPhase("done");
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        toast({
          title: OUTCOME_LABELS[data.outcome ?? ""] ?? "Game Over",
          description: data.payout ? `Payout: ${formatCurrency(data.payout)}` : "",
          variant: data.won ? "default" : "destructive",
        });
      } else {
        setPhase("play");
      }
    }
  }

  async function handleAction(action: "hit" | "stand") {
    const data = await actionApi.call("blackjack/action", { action });
    if (data) {
      if (action === "hit" && !data.done) {
        setGameState(prev => prev ? { ...prev, playerCards: data.playerCards, playerTotal: data.playerTotal } : prev);
      } else {
        setActionState(data);
        setPhase("done");
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        toast({
          title: OUTCOME_LABELS[data.outcome ?? ""] ?? "Game Over",
          description: data.payout ? `Payout: ${formatCurrency(data.payout)}` : "",
          variant: data.won ? "default" : "destructive",
        });
      }
    }
  }

  function handleReset() {
    setGameState(null);
    setActionState(null);
    setPhase("bet");
    dealApi.reset();
    actionApi.reset();
  }

  const finalState = actionState ?? (gameState?.done ? gameState : null);
  const currentGame = gameState;

  return (
    <GameShell casinoId={casinoId} gameType="blackjack" payTableEntries={GAME_PAY_TABLES.blackjack} title="Blackjack" description="Beat the dealer to 21. Blackjack pays 2.5×. Dealer stands on 17." accentColor="text-green-400">
      <div className="space-y-6">
        {/* Table */}
        <Card className="bg-[#0a1f0a] border-green-900/50 min-h-[400px] shadow-[0_0_40px_rgba(34,197,94,0.05)]">
          <CardContent className="p-8 space-y-8">
            {/* Dealer */}
            <AnimatePresence>
              {currentGame && (
                <motion.div
                  key="dealer"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Hand
                    label="Dealer"
                    cards={finalState?.dealerCards ?? [currentGame.dealerUpcard ?? "?", "?"]}
                    total={finalState?.dealerTotal ?? null}
                    hidden={phase === "play"}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divider */}
            {currentGame && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                className="border-t border-green-900/40"
              />
            )}

            {/* Player */}
            <AnimatePresence>
              {currentGame && (
                <motion.div
                  key="player"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Hand
                    label="You"
                    cards={currentGame.playerCards}
                    total={currentGame.playerTotal}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Outcome */}
            <AnimatePresence>
              {finalState && (
                <motion.div
                  key="outcome"
                  initial={{ opacity: 0, scale: 0.85, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className={`text-center p-5 rounded-2xl ${
                    finalState.won ? "bg-primary/10 border border-primary/30 shadow-[0_0_20px_rgba(0,255,170,0.1)]" :
                    finalState.outcome === "push" ? "bg-yellow-400/10 border border-yellow-400/30" :
                    "bg-destructive/10 border border-destructive/30"
                  }`}
                >
                  <p className={`text-2xl font-display font-bold ${
                    finalState.won ? "text-primary" :
                    finalState.outcome === "push" ? "text-yellow-400" :
                    "text-destructive"
                  }`}>
                    {OUTCOME_LABELS[finalState.outcome ?? ""] ?? "Game Over"}
                  </p>
                  {finalState.payout !== undefined && (
                    <p className="text-muted-foreground text-sm mt-1">
                      Payout: {formatCurrency(finalState.payout)} · Balance: {formatCurrency(finalState.newBalance ?? 0)}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {!currentGame && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center h-48 flex-col gap-3"
              >
                <span className="text-5xl opacity-20">🃏</span>
                <p className="text-muted-foreground text-sm">Place your bet and deal to start</p>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {phase === "bet" && (
                <motion.div
                  key="bet-phase"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                  {dealApi.error && <p className="text-sm text-destructive">{dealApi.error}</p>}
                  <motion.div whileTap={{ scale: 0.97 }}>
                    <Button
                      className="w-full bg-green-700 hover:bg-green-600 text-white font-bold text-lg shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                      size="lg"
                      disabled={loading}
                      onClick={handleDeal}
                    >
                      {loading ? "Dealing…" : "🃏 Deal"}
                    </Button>
                  </motion.div>
                </motion.div>
              )}

              {phase === "play" && (
                <motion.div
                  key="play-phase"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-3"
                >
                  <p className="text-center text-muted-foreground text-sm">
                    Your total: <span className="font-mono font-bold text-white">{currentGame?.playerTotal}</span>
                  </p>
                  {actionApi.error && <p className="text-sm text-destructive">{actionApi.error}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg h-14 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                        disabled={loading}
                        onClick={() => handleAction("hit")}
                      >
                        {loading ? "…" : "👊 Hit"}
                      </Button>
                    </motion.div>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        className="w-full bg-red-700 hover:bg-red-600 text-white font-bold text-lg h-14 shadow-[0_0_20px_rgba(185,28,28,0.3)]"
                        disabled={loading}
                        onClick={() => handleAction("stand")}
                      >
                        {loading ? "…" : "✋ Stand"}
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {phase === "done" && (
                <motion.div
                  key="done-phase"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    className="w-full bg-green-700 hover:bg-green-600 text-white font-bold text-lg shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                    size="lg"
                    onClick={handleReset}
                  >
                    🃏 New Hand
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
