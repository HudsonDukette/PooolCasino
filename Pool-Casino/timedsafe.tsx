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
type Phase = "idle" | "waiting" | "done";

export default function TimedSafe() {
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

  useEffect(() => {
    if (phase === "waiting") {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const e = (Date.now() - startRef.current!) / 1000;
        setElapsed(Math.min(30, e));
        if (e >= 30) { clearInterval(timerRef.current); }
      }, 100);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setElapsed(0);
    try {
      const res = await fetch(`${BASE}api/timedsafe/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("waiting");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleOpen() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/timedsafe/open`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      clearInterval(timerRef.current);
      setPhase("done"); setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `🔓 Safe opened! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `🔒 Wrong timing. Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const ratio = elapsed / 30;
  const currentEst = 0.5 + ratio * 1.0;

  return (
    <GameShell casinoId={casinoId} gameType="timedsafe" payTableEntries={GAME_PAY_TABLES.timedsafe} title="Timed Safe" description="A safe opens at a random time between 5–30 seconds. Open it just as it cracks for the biggest reward!" accentColor="text-cyan-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase === "idle" || phase === "done" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Open early (before crack): 0.5–1.5×</p>
                  <p>Open at crack moment: 1.5–5×</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#0891b2,#164e63)", boxShadow: "0 0 20px rgba(8,145,178,0.3)" }}>
                  {loading ? "Locking…" : "🔒 Start Safe"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Elapsed</span>
                    <span className="text-white font-mono">{elapsed.toFixed(1)}s / 30s</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <p className="text-center text-sm text-muted-foreground">Estimated mult if opened now: <span className="text-cyan-400 font-bold">{currentEst.toFixed(2)}×</span></p>
                </div>
                <Button className="w-full h-16 text-xl font-black bg-cyan-600 hover:bg-cyan-500" disabled={loading} onClick={handleOpen}>
                  🔓 OPEN SAFE NOW
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
                  <div className="text-6xl">{result.cracked ? "🔓" : "🔒"}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {result.cracked ? "✅ Opened after crack!" : "⏰ Opened before crack"} · {result.multiplier}×
                  </p>
                  <p className="text-xs text-muted-foreground">Safe cracked at: {(result.crackAt / 1000).toFixed(1)}s</p>
                </motion.div>
              ) : phase === "waiting" ? (
                <motion.div key="waiting" className="text-center space-y-3">
                  <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-7xl">🔒</motion.div>
                  <p className="text-cyan-400 font-semibold">Safe is ticking...</p>
                  <p className="text-muted-foreground text-sm">Open at the right moment!</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🔐</div>
                  <p className="text-muted-foreground text-sm">A safe with a random crack time</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
