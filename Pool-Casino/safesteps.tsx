import React, { useState } from "react";
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
const STEP_MULTS = [0, 1.2, 1.5, 1.9, 2.5, 3.2, 4.0, 5.0, 6.5, 8.5, 12];
const STEP_FAIL = [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60];
type Phase = "idle" | "playing" | "done";

export default function SafeSteps() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [accumulated, setAccumulated] = useState(1);
  const [result, setResult] = useState<any>(null);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setStep(0); setAccumulated(1);
    try {
      const res = await fetch(`${BASE}api/safesteps/start`, {
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

  async function handleStep() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/safesteps/step`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStep(data.step);
      if (data.failed) {
        setPhase("done"); setResult(data);
        toast({ title: `💀 Fell at step ${data.step}! Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else {
        setAccumulated(data.accumulated);
        toast({ title: `✅ Step ${data.step} safe! ${data.accumulated}×`, className: "bg-success text-success-foreground border-none" });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/safesteps/cashout`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("done"); setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `💰 Step ${data.step} cashout! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell casinoId={casinoId} gameType="safesteps" payTableEntries={GAME_PAY_TABLES.safesteps} title="Safe Steps" description="Take steps forward — each one is harder to survive but multiplies your reward. Cash out before you fall!" accentColor="text-teal-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase === "idle" || phase === "done" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="grid grid-cols-5 gap-1 text-xs text-center">
                  {STEP_MULTS.slice(1).map((m, i) => (
                    <div key={i} className="bg-black/20 rounded-lg p-1">
                      <div className="text-teal-400 font-bold">{m}×</div>
                      <div className="text-muted-foreground">{STEP_FAIL[i + 1]}%</div>
                    </div>
                  ))}
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 0 20px rgba(13,148,136,0.3)" }}>
                  {loading ? "Starting…" : "👣 Start Walking"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-black text-teal-400">Step {step}/10</div>
                  <div className="text-sm text-muted-foreground">Current: {accumulated}×</div>
                </div>
                <div className="relative">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className={`mb-1 h-6 rounded flex items-center px-3 text-xs transition-all ${
                      i < step ? "bg-teal-500/30 border border-teal-500/50 text-teal-300" :
                      i === step ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 animate-pulse" :
                      "bg-black/20 border border-white/5 text-muted-foreground"
                    }`}>
                      Step {i + 1}: {STEP_MULTS[i + 1]}× ({STEP_FAIL[i + 1]}% fail)
                    </div>
                  ))}
                </div>
                <Button className="w-full h-12 font-bold bg-teal-600 hover:bg-teal-500" disabled={loading || step >= 10} onClick={handleStep}>
                  👣 Take Step {step + 1} ({STEP_FAIL[step + 1]}% risk)
                </Button>
                <Button variant="outline" className="w-full" disabled={loading || step === 0} onClick={handleCashout}>
                  💰 Cash Out ({accumulated}×)
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
                  <div className="text-6xl">{result.failed ? "💀" : "💰"}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">{result.failed ? `Fell at step ${result.step}` : `Cashed at step ${result.step} · ${result.multiplier}×`}</p>
                </motion.div>
              ) : phase === "playing" ? (
                <motion.div key="playing" className="text-center space-y-3">
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="text-6xl">🧗</motion.div>
                  <p className="text-teal-400 font-bold text-xl">Step {step}</p>
                  <p className="text-muted-foreground text-sm">{accumulated}× ready to cash out</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🪜</div>
                  <p className="text-muted-foreground text-sm">10 steps, increasing risk</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
