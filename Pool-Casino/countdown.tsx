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
type Phase = "idle" | "counting" | "done";

export default function Countdown() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [result, setResult] = useState<any>(null);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (phase === "counting") {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startRef.current!) / 1000;
        const left = Math.max(0, 10 - elapsed);
        setSecondsLeft(parseFloat(left.toFixed(1)));
        if (left <= 0) clearInterval(timerRef.current);
      }, 100);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setSecondsLeft(10);
    try {
      const res = await fetch(`${BASE}api/countdown/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("counting");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/countdown/cashout`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      clearInterval(timerRef.current);
      setPhase("done"); setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `⏱️ ${data.secondsLeft}s left! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `Timer expired. Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const ratio = secondsLeft / 10;
  const estimatedMult = (0.5 + ratio * 2.5).toFixed(2);
  const secColor = secondsLeft > 6 ? "text-emerald-400" : secondsLeft > 3 ? "text-yellow-400" : "text-red-400";

  return (
    <GameShell casinoId={casinoId} gameType="countdown" payTableEntries={GAME_PAY_TABLES.countdown} title="Countdown Gamble" description="10 seconds on the clock — more time left means a higher multiplier. Cash out at the right moment!" accentColor="text-blue-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase !== "counting" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>10s left → 3.0× · 5s left → 1.75× · 0s → 0.5×</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", boxShadow: "0 0 20px rgba(37,99,235,0.3)" }}>
                  {loading ? "Starting…" : "⏱️ Start Countdown"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="w-full bg-black/40 rounded-full h-4 overflow-hidden">
                    <motion.div className="h-full rounded-full transition-all" style={{ width: `${ratio * 100}%`, background: `linear-gradient(90deg, #dc2626, #f59e0b, #10b981)` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0s</span><span className={`font-mono font-bold ${secColor}`}>{secondsLeft.toFixed(1)}s left</span><span>10s</span>
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">Estimated multiplier: <span className="text-blue-400 font-bold">{estimatedMult}×</span></p>
                <Button className="w-full h-14 text-xl font-black bg-blue-600 hover:bg-blue-500" disabled={loading} onClick={handleCashout}>
                  ⏱️ CASH OUT NOW
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
                  <div className="text-6xl">⏱️</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground">{result.secondsLeft}s remaining · {result.multiplier}×</p>
                </motion.div>
              ) : phase === "counting" ? (
                <motion.div key="counting" className="text-center space-y-3">
                  <motion.div animate={{ scale: [1, secondsLeft < 3 ? 1.3 : 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }} className={`text-7xl font-black ${secColor}`}>
                    {Math.ceil(secondsLeft)}
                  </motion.div>
                  <p className="text-muted-foreground text-sm">Cash out while time remains!</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">⏰</div>
                  <p className="text-muted-foreground text-sm">Wait for the right moment</p>
                  <p className="text-xs text-muted-foreground/60">More time left = better multiplier</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
