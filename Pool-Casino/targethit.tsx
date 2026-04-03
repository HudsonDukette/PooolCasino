import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = import.meta.env.BASE_URL;
type Phase = "idle" | "waiting" | "done";

export default function TargetHit() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<any>(null);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setElapsed(0);
    try {
      const res = await fetch(`${BASE}api/targethit/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("waiting");
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const e = (Date.now() - startRef.current!) / 1000;
        setElapsed(Math.min(5, e));
        if (e >= 5) clearInterval(timerRef.current);
      }, 100);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleClick() {
    if (phase !== "waiting" || loading) return;
    clearInterval(timerRef.current);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/targethit/click`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("done"); setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `🎯 ${data.accuracy}% accuracy! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `🎯 ${data.accuracy}% accuracy. Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const barPct = (elapsed / 5) * 100;

  return (
    <GameShell casinoId={casinoId} gameType="targethit" payTableEntries={GAME_PAY_TABLES.targethit} title="Target Hit" description="A hidden target is set at a random moment in a 5-second window. Click exactly when the bar hits your timing sweet spot!" accentColor="text-red-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase !== "waiting" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Perfect timing: 4× · Good: 2× · Okay: 1× · Miss: 0.5×</p>
                  <p>The target is hidden and set at a random moment</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)", boxShadow: "0 0 20px rgba(220,38,38,0.3)" }}>
                  {loading ? "Setting…" : "🎯 Set Target"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">Watch the bar — click when you think the target moment arrives!</p>
                <div className="relative">
                  <div className="w-full bg-black/40 rounded-full h-8 overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ width: `${barPct}%`, background: "linear-gradient(90deg,#22c55e,#eab308,#ef4444)" }} />
                  </div>
                </div>
                <Button className="w-full h-20 text-2xl font-black bg-red-600 hover:bg-red-500 active:scale-95 transition-transform" onClick={handleClick} disabled={loading}>
                  🎯 HIT!
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[250px]">
            <AnimatePresence mode="wait">
              {phase === "done" && result ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3">
                  <div className="text-6xl">{result.accuracy >= 80 ? "🎯" : result.accuracy >= 50 ? "✅" : "💨"}</div>
                  <div className="text-2xl font-bold text-white">{result.accuracy}% accuracy</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">{result.multiplier.toFixed(2)}× multiplier · {result.diff}ms off target</p>
                </motion.div>
              ) : phase === "waiting" ? (
                <motion.div key="waiting" className="text-center space-y-3">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-6xl">🎯</motion.div>
                  <p className="text-red-400 font-bold text-xl">Watch the bar!</p>
                  <p className="text-muted-foreground text-sm">Click when the moment feels right</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🎯</div>
                  <p className="text-muted-foreground text-sm">Time your click perfectly</p>
                  <p className="text-xs text-muted-foreground/60">The target moment is hidden — trust your instinct!</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
