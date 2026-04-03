import React, { useState, useEffect, useRef } from "react";
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
type Phase = "idle" | "playing" | "done";

export default function ReverseCrash() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentMult, setCurrentMult] = useState(10);
  const [result, setResult] = useState<any>(null);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (phase === "playing") {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startRef.current!) / 1000;
        const m = Math.max(1, 10 - elapsed * 2);
        setCurrentMult(parseFloat(m.toFixed(2)));
        if (m <= 1) clearInterval(timerRef.current);
      }, 100);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setCurrentMult(10);
    try {
      const res = await fetch(`${BASE}api/reversecrash/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("playing");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/reversecrash/cashout`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      clearInterval(timerRef.current);
      setPhase("done"); setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `📉 Cashed out! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `💥 Multiplier already crashed!`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const multColor = currentMult > 6 ? "text-emerald-400" : currentMult > 3 ? "text-yellow-400" : currentMult > 1.5 ? "text-orange-400" : "text-red-400";

  return (
    <GameShell casinoId={casinoId} gameType="reversecrash" payTableEntries={GAME_PAY_TABLES.reversecrash} title="Reverse Crash" description="The multiplier starts HIGH and crashes DOWN to 1×. Cash out before it hits the hidden crash point!" accentColor="text-red-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase !== "playing" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)", boxShadow: "0 0 20px rgba(220,38,38,0.3)" }}>
                  {loading ? "Starting…" : "📉 Start Drop"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className={`text-center p-6 rounded-xl border ${currentMult > 3 ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"}`}>
                  <div className={`text-5xl font-black ${multColor}`}>{currentMult.toFixed(2)}×</div>
                  <div className="text-sm text-muted-foreground mt-1">Dropping...</div>
                </div>
                <Button className="w-full h-14 text-xl font-black bg-red-600 hover:bg-red-500" disabled={loading} onClick={handleCashout}>
                  💰 CASH OUT NOW
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
                  <div className="text-6xl">{result.alreadyCrashed ? "💥" : "💰"}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {result.alreadyCrashed ? `💥 Already crashed at ${result.crashedAt}×` : `✅ Cashed at ${result.current}×`}
                  </p>
                </motion.div>
              ) : phase === "playing" ? (
                <motion.div key="playing" className="text-center space-y-3">
                  <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="text-6xl">📉</motion.div>
                  <p className={`font-black text-2xl ${multColor}`}>{currentMult.toFixed(2)}×</p>
                  <p className="text-muted-foreground text-sm">Cash out before it crashes to 1×!</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">📊</div>
                  <p className="text-muted-foreground text-sm">Starts at 10× and falls fast</p>
                  <p className="text-xs text-muted-foreground/60">The crash point is hidden and random</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
