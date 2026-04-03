import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-ladder.png";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = import.meta.env.BASE_URL;

const RUNGS = [
  { rung: 10, mult: "30×",  fail: "55%", color: "text-red-400",    bg: "bg-red-500/20",    border: "border-red-500/40" },
  { rung: 9,  mult: "20×",  fail: "49%", color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/40" },
  { rung: 8,  mult: "14×",  fail: "42%", color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/40" },
  { rung: 7,  mult: "10×",  fail: "36%", color: "text-lime-400",   bg: "bg-lime-500/20",   border: "border-lime-500/40" },
  { rung: 6,  mult: "7.5×", fail: "30%", color: "text-green-400",  bg: "bg-green-500/20",  border: "border-green-500/40" },
  { rung: 5,  mult: "5.5×", fail: "25%", color: "text-emerald-400",bg: "bg-emerald-500/20",border: "border-emerald-500/40" },
  { rung: 4,  mult: "4×",   fail: "20%", color: "text-cyan-400",   bg: "bg-cyan-500/20",   border: "border-cyan-500/40" },
  { rung: 3,  mult: "2.8×", fail: "16%", color: "text-sky-400",    bg: "bg-sky-500/20",    border: "border-sky-500/40" },
  { rung: 2,  mult: "2×",   fail: "13%", color: "text-blue-400",   bg: "bg-blue-500/20",   border: "border-blue-500/40" },
  { rung: 1,  mult: "1.4×", fail: "10%", color: "text-indigo-400", bg: "bg-indigo-500/20", border: "border-indigo-500/40" },
];

type Phase = "idle" | "playing" | "failed" | "cashedout";

export default function Ladder() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [phase, setPhase] = useState<Phase>("idle");
  const [loading, setLoading] = useState(false);
  const [currentRung, setCurrentRung] = useState(0);
  const [betAmountActive, setBetAmountActive] = useState(0);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch(`${BASE}api/games/ladder/status`, { credentials: "include" })
      .then(r => r.json()).then(d => {
        if (d.active) {
          setCurrentRung(d.currentRung);
          setBetAmountActive(d.betAmount);
          setBetAmount(String(d.betAmount));
          setPhase("playing");
        }
      }).catch(() => {});
  }, []);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/games/ladder/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCurrentRung(0);
      setBetAmountActive(bet);
      setPhase("playing");
      setResult(null);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleStep() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/games/ladder/step`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.failed) {
        setPhase("failed");
        setResult(data);
        toast({ title: `💀 Fell at rung ${data.failedAtRung}. Lost ${formatCurrency(betAmountActive)}`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      } else {
        setCurrentRung(data.currentRung);
        if (data.atTop) { toast({ title: "🏆 Reached the top! Cash out!" }); }
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    if (loading || currentRung === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/games/ladder/cashout`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("cashedout");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      toast({ title: `💰 Cashed out ${formatCurrency(data.payout)}! (${data.multiplier}×)`, className: "bg-success text-success-foreground border-none" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleAbandon() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch(`${BASE}api/games/ladder/abandon`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      setPhase("failed");
      setResult({ failedAtRung: 0 });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch {} finally { setLoading(false); }
  }

  function reset() { setPhase("idle"); setCurrentRung(0); setResult(null); }

  const MULTS = [0, 1.4, 2.0, 2.8, 4.0, 5.5, 7.5, 10, 14, 20, 30];

  return (
    <GameShell casinoId={casinoId} gameType="ladder" payTableEntries={GAME_PAY_TABLES.ladder} heroImage={heroImg} title="Risk Ladder" description="Climb 10 rungs for escalating multipliers. Stop and cash out anytime — or push your luck." accentColor="text-lime-400" backHref={casinoId !== undefined ? `/casino/${casinoId}` : "/games"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Ladder visual */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-4 space-y-1.5">
            {RUNGS.map(({ rung, mult, fail, color, bg, border }) => {
              const isActive = currentRung === rung && phase === "playing";
              const isPassed = currentRung >= rung && phase !== "idle";
              const isFailed = result?.failedAtRung === rung;
              return (
                <motion.div key={rung}
                  animate={isActive ? { x: [0, 4, -4, 0] } : {}}
                  transition={{ repeat: isActive ? Infinity : 0, duration: 0.8 }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                    isFailed ? "bg-red-950/60 border-red-500/60 text-red-300"
                    : isActive ? `${bg} ${border} ${color} ring-1 ring-current`
                    : isPassed ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/3 border-white/5 text-muted-foreground"
                  }`}>
                  <span className="w-8">R{rung}</span>
                  <span className="font-mono">{mult}</span>
                  <span className="opacity-60">fail {fail}</span>
                  <span>{isFailed ? "💀" : isActive ? "→" : isPassed ? "✓" : ""}</span>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase === "idle" ? (
              <>
                <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                <Button className="w-full bg-lime-600/90 hover:bg-lime-500 text-black font-bold shadow-[0_0_20px_rgba(132,204,22,0.3)]"
                  size="lg" disabled={loading} onClick={handleStart}>
                  {loading ? "Starting…" : "🪜 Start Climbing"}
                </Button>
              </>
            ) : phase === "playing" ? (
              <div className="space-y-4">
                <div className="bg-black/40 rounded-xl p-4 border border-lime-500/20 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current rung</span><span className="font-bold text-white">{currentRung} / 10</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Multiplier</span><span className="font-mono font-bold text-lime-400">{MULTS[currentRung]}×</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">If cash out</span><span className="font-mono font-bold text-white">{formatCurrency(betAmountActive * MULTS[currentRung])}</span></div>
                </div>
                <Button className="w-full bg-lime-600/90 hover:bg-lime-500 text-black font-bold" size="lg" disabled={loading || currentRung === 10} onClick={handleStep}>
                  {loading ? "Stepping…" : currentRung === 10 ? "At the top!" : "⬆️ Step Up"}
                </Button>
                <Button className="w-full bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold" size="lg" disabled={loading || currentRung === 0} onClick={handleCashout}>
                  {loading ? "Processing…" : `💰 Cash Out ${formatCurrency(betAmountActive * MULTS[currentRung])}`}
                </Button>
                <Button variant="ghost" className="w-full text-red-400/70 hover:text-red-400 hover:bg-red-500/10 text-xs" size="sm" disabled={loading} onClick={handleAbandon}>
                  Abandon (forfeit bet)
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`text-center px-4 py-4 rounded-xl border ${phase === "cashedout" ? "bg-emerald-950/40 border-emerald-500/30" : "bg-red-950/40 border-red-500/30"}`}>
                  {phase === "cashedout" ? (
                    <>
                      <p className="text-2xl font-display font-bold text-emerald-300">+{formatCurrency(result?.payout)}</p>
                      <p className="text-sm text-muted-foreground">{result?.multiplier}× at rung {result?.rung}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-display font-bold text-red-400">💀 Fell!</p>
                      <p className="text-sm text-muted-foreground">Lost {formatCurrency(betAmountActive)}</p>
                    </>
                  )}
                </div>
                <Button className="w-full font-bold" size="lg" onClick={reset}>🔄 Play Again</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
