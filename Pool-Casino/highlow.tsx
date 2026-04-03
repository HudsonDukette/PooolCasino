import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-highlow.png";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = import.meta.env.BASE_URL;

function CardFace({ label, flipped = false }: { label: string; flipped?: boolean }) {
  const isRoyal = ["J","Q","K","A"].includes(label);
  return (
    <motion.div
      animate={flipped ? { rotateY: 0 } : { rotateY: 0 }}
      className="w-28 h-40 rounded-2xl border-2 border-white/20 bg-gradient-to-br from-white/15 to-white/5 shadow-2xl flex flex-col items-center justify-center select-none"
    >
      <span className={`text-5xl font-display font-black ${isRoyal ? "text-yellow-300" : "text-white"}`}>{label}</span>
      <span className={`text-2xl ${isRoyal ? "text-yellow-300" : "text-white"}`}>♠</span>
    </motion.div>
  );
}

export default function HighLow() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [currentCard, setCurrentCard] = useState<{ card: number; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => { fetchCard(); }, []);

  async function fetchCard() {
    try {
      const res = await fetch(`${BASE}api/games/highlow/card`, { credentials: "include" });
      const data = await res.json();
      setCurrentCard(data);
      setResult(null);
    } catch {}
  }

  async function handleGuess(guess: "higher" | "lower") {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (!currentCard) return;
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}api/games/highlow`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, guess, card1: currentCard.card, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      if (data.tie) toast({ title: "🤝 Tie — push! Bet returned." });
      else if (data.won) toast({ title: `⬆️ Correct! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `Wrong guess. Lost ${formatCurrency(bet)}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  function handleNext() { fetchCard(); }

  return (
    <GameShell casinoId={casinoId} gameType="highlow" payTableEntries={GAME_PAY_TABLES.highlow} heroImage={heroImg} title="High-Low" description="Guess if the next card is higher or lower. Win 1.85× — ties push your bet back." accentColor="text-yellow-400" backHref={casinoId !== undefined ? `/casino/${casinoId}` : "/games"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            </div>
            {!result ? (
              <>
                <p className="text-xs text-muted-foreground">Will the next card be…</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button className="h-14 bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold text-lg"
                    disabled={loading || !currentCard} onClick={() => handleGuess("higher")}>
                    ⬆️ Higher
                  </Button>
                  <Button className="h-14 bg-red-600/80 hover:bg-red-500 text-white font-bold text-lg"
                    disabled={loading || !currentCard} onClick={() => handleGuess("lower")}>
                    ⬇️ Lower
                  </Button>
                </div>
              </>
            ) : (
              <Button className="w-full font-bold" size="lg" onClick={handleNext}>🔄 Next Card</Button>
            )}
            <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-white/5">
              <p>• Correct guess pays <span className="text-white font-mono">1.85×</span></p>
              <p>• Tie (same card) = push, bet returned</p>
              <p>• Cards are drawn randomly 1–13</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[250px]">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">Current Card</p>
                {currentCard && <CardFace label={currentCard.label} />}
              </div>
              <AnimatePresence>
                {result && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center space-y-2">
                    <p className="text-xs text-muted-foreground">Next Card</p>
                    <CardFace label={result.card2} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`text-center px-6 py-2 rounded-xl border text-sm font-bold ${
                    result.tie ? "bg-yellow-950/40 border-yellow-500/30 text-yellow-300"
                    : result.won ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : "bg-red-950/40 border-red-500/30 text-red-300"
                  }`}>
                  {result.tie ? "🤝 Tie — push" : result.won ? `✅ +${formatCurrency(result.payout)}` : `❌ Lost`}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
