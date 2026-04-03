import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-lightning.png";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = import.meta.env.BASE_URL;

export default function Lightning() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [rounds, setRounds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [sequence, setSequence] = useState<Array<{ won: boolean; payout: number }>>([]);
  const [revealed, setRevealed] = useState(0);
  const [finalResult, setFinalResult] = useState<any>(null);
  const revealInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearReveal() {
    if (revealInterval.current) { clearInterval(revealInterval.current); revealInterval.current = null; }
  }

  async function handlePlay() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    clearReveal();
    setLoading(true);
    setSequence([]);
    setRevealed(0);
    setFinalResult(null);
    try {
      const res = await fetch(`${BASE}api/games/lightning`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, rounds, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSequence(data.sequence);
      setLoading(false);

      // Animate reveals
      let i = 0;
      revealInterval.current = setInterval(() => {
        i++;
        setRevealed(i);
        if (i >= data.sequence.length) {
          clearReveal();
          setFinalResult(data);
          qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
          qc.invalidateQueries({ queryKey: ["/api/pool"] });
          if (data.won) toast({ title: `⚡ ${data.winsCount}/${data.rounds} wins! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
          else toast({ title: `${data.winsCount}/${data.rounds} wins. Net loss.`, variant: "destructive" });
        }
      }, 350);
    } catch (err: unknown) {
      setLoading(false);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    }
  }

  useEffect(() => () => clearReveal(), []);

  const bet = parseFloat(betAmount) || 0;
  const totalCost = bet * rounds;

  return (
    <GameShell casinoId={casinoId} gameType="lightning" payTableEntries={GAME_PAY_TABLES.lightning} heroImage={heroImg} title="Lightning Round" description="N rapid-fire 50/50 flips at 1.9×. Each round is independent — win as many as you can." accentColor="text-yellow-300" backHref={casinoId !== undefined ? `/casino/${casinoId}` : "/games"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Per Round</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
              <p className="text-xs text-muted-foreground">Total cost: <span className="text-white font-mono">{formatCurrency(totalCost)}</span> ({rounds} rounds)</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Rounds</p>
              <div className="flex gap-3">
                {[3, 5, 10].map(r => (
                  <button key={r} disabled={loading} onClick={() => setRounds(r)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                      rounds === r ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300" : "bg-black/30 border-white/10 text-muted-foreground hover:border-white/20"
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full font-bold shadow-[0_0_20px_rgba(234,179,8,0.3)]"
              style={{ background: "linear-gradient(135deg, #ca8a04, #f59e0b)" }}
              size="lg" disabled={loading || revealed < sequence.length && sequence.length > 0} onClick={handlePlay}>
              {loading ? "Launching…" : `⚡ Start ${rounds} Rounds`}
            </Button>
            <AnimatePresence>
              {finalResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`text-center px-4 py-3 rounded-xl border ${finalResult.won ? "bg-yellow-950/40 border-yellow-500/30" : "bg-black/30 border-white/10"}`}>
                  <p className="text-xs text-muted-foreground">{finalResult.winsCount}/{finalResult.rounds} wins</p>
                  <p className={`font-display font-bold text-xl ${finalResult.won ? "text-yellow-300" : "text-red-400"}`}>
                    {finalResult.won ? `+${formatCurrency(finalResult.payout)}` : `−${formatCurrency(totalCost - finalResult.payout)}`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col justify-center gap-3 min-h-[260px]">
            {sequence.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">Results appear here</p>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                {sequence.map((s, i) => (
                  <AnimatePresence key={i}>
                    {i < revealed && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center text-center border ${
                          s.won ? "bg-yellow-500/20 border-yellow-500/50" : "bg-red-950/40 border-red-500/30"
                        }`}
                      >
                        <span className="text-xl">{s.won ? "⚡" : "✕"}</span>
                        <span className={`text-[10px] font-mono font-bold ${s.won ? "text-yellow-300" : "text-red-400"}`}>
                          {s.won ? `+${formatCurrency(s.payout)}` : ""}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
