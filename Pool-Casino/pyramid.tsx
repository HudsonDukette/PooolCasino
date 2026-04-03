import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-pyramid.png";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { ChevronUp, TrendingUp, Trophy } from "lucide-react";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = import.meta.env.BASE_URL;

const PAYOUTS = [0, 1.9, 3.8, 7.5, 15, 30, 60, 120, 240, 480, 960];

type Phase = "idle" | "playing" | "failed" | "cashedOut" | "won";

async function apiPost(path: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${BASE}api/games/${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiGet(path: string) {
  const res = await fetch(`${BASE}api/games/${path}`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function Pyramid() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState("100");
  const [phase, setPhase] = useState<Phase>("idle");
  const [loading, setLoading] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [failedAtLevel, setFailedAtLevel] = useState<number | null>(null);
  const [potentialPayout, setPotentialPayout] = useState(0);
  const [finalPayout, setFinalPayout] = useState(0);
  const [activeBet, setActiveBet] = useState(0);

  const bet = parseFloat(betAmount) || 0;

  useEffect(() => {
    apiGet("pyramid/status").then((data) => {
      if (!data.active) return;
      setCurrentLevel(data.currentLevel);
      setActiveBet(data.betAmount);
      setBetAmount(String(data.betAmount));
      setPotentialPayout(data.potentialPayout);
      setPhase("playing");
    }).catch(() => {});
  }, []);

  function reset() {
    setPhase("idle");
    setCurrentLevel(0);
    setFailedAtLevel(null);
    setPotentialPayout(0);
    setFinalPayout(0);
    qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    qc.invalidateQueries({ queryKey: ["/api/pool"] });
  }

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await apiPost("pyramid/start", { betAmount: bet, casinoId });
      setActiveBet(bet);
      setCurrentLevel(0);
      setFailedAtLevel(null);
      setPotentialPayout(0);
      setPhase("playing");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleAdvance() {
    if (phase !== "playing" || loading) return;
    setLoading(true);
    try {
      const data = await apiPost("pyramid/advance", {});
      if (!data.passed) {
        setFailedAtLevel(data.failedAtLevel);
        setPhase("failed");
        toast({ title: `💀 Failed at Level ${data.failedAtLevel}!`, description: `Lost ${formatCurrency(activeBet)}`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      } else if (data.reachedTop) {
        setCurrentLevel(10);
        setFinalPayout(data.payout);
        setPhase("won");
        toast({ title: `🏆 Summit reached! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      } else {
        setCurrentLevel(data.level);
        setPotentialPayout(data.potentialPayout);
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashOut() {
    if (phase !== "playing" || loading || currentLevel === 0) return;
    setLoading(true);
    try {
      const data = await apiPost("pyramid/cashout", {});
      setFinalPayout(data.payout);
      setPhase("cashedOut");
      toast({ title: `💰 Cashed out ${formatCurrency(data.payout)}!`, description: `${data.multiplier}× at Level ${data.level}`, className: "bg-success text-success-foreground border-none" });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const displayLevel = failedAtLevel ?? currentLevel;

  return (
    <GameShell casinoId={casinoId} gameType="pyramid" payTableEntries={GAME_PAY_TABLES.pyramid} heroImage={heroImg} title="Pyramid Climb" description="Scale 10 levels — each a 50/50 coin flip. Cash out any time or push your luck to the summit for 960×!" accentColor="text-amber-400">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">

        {/* Pyramid Visual */}
        <Card className="bg-black/70 border-white/10 order-2 lg:order-1">
          <CardContent className="p-5 flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Level Map</p>
            <div className="flex flex-col items-center gap-1.5 w-full">
              {Array.from({ length: 10 }, (_, i) => {
                const lvl = 10 - i;
                const widthPct = 22 + lvl * 7.8;
                const isPassed = phase !== "idle" && lvl <= currentLevel && failedAtLevel === null;
                const isFailed = failedAtLevel === lvl;
                const isCurrent = phase === "playing" && lvl === currentLevel;
                const isNext = phase === "playing" && lvl === currentLevel + 1;
                const isWon = (phase === "won" || phase === "cashedOut") && lvl <= (phase === "won" ? 10 : currentLevel);
                return (
                  <motion.div key={lvl}
                    animate={isCurrent ? { scale: [1, 1.04, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ width: `${widthPct}%` }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all duration-300 ${
                      isFailed ? "bg-red-950/70 border-red-500/60 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                      : isWon || isPassed ? "bg-amber-950/60 border-amber-500/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                      : isCurrent ? "bg-amber-900/40 border-amber-400/80 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.4)]"
                      : isNext ? "bg-white/5 border-white/20 text-white/70"
                      : "bg-white/[0.03] border-white/5 text-muted-foreground"
                    }`}>
                    <span className="font-mono w-12">LVL {lvl}</span>
                    <span className="text-[10px] opacity-60">50%</span>
                    <span className="font-mono">{PAYOUTS[lvl]}×</span>
                    <span className="w-5 text-center">
                      {isFailed ? "💀" : (isWon || isPassed) ? "✅" : isNext ? "→" : ""}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-card/40 border-white/10 order-1 lg:order-2">
          <CardContent className="p-6 space-y-5">

            {/* Idle */}
            {phase === "idle" && (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="bg-black/30 rounded-xl p-4 space-y-2 border border-white/5 text-xs text-muted-foreground">
                  <p className="font-semibold text-amber-400">How to Play</p>
                  <p>Place your bet. Then advance one level at a time — each level is a 50/50. Cash out any time to lock in your multiplier, or reach Level 10 for <span className="text-amber-300 font-bold">960×</span>!</p>
                </div>
                <Button className="w-full bg-amber-600/90 hover:bg-amber-500 text-black font-bold shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                  size="lg" disabled={loading || bet < 0.01} onClick={handleStart}>
                  {loading ? "Starting…" : "🔺 Start Climbing"}
                </Button>
              </>
            )}

            {/* Playing */}
            {phase === "playing" && (
              <>
                <div className="bg-black/40 rounded-xl p-4 space-y-2 border border-amber-500/20">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bet placed</span>
                    <span className="font-mono font-bold text-white">{formatCurrency(activeBet)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current level</span>
                    <span className="font-mono font-bold text-amber-300">{currentLevel === 0 ? "Not started" : `Level ${currentLevel} ✅`}</span>
                  </div>
                  {currentLevel > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cash out now</span>
                      <span className="font-mono font-bold text-amber-200">{formatCurrency(potentialPayout)} ({PAYOUTS[currentLevel]}×)</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Next level payout</span>
                    <span className="font-mono font-bold text-white">{formatCurrency(activeBet * PAYOUTS[currentLevel + 1])} ({PAYOUTS[currentLevel + 1]}×)</span>
                  </div>
                </div>

                <Button className="w-full bg-amber-600/90 hover:bg-amber-500 text-black font-bold shadow-[0_0_20px_rgba(245,158,11,0.4)] text-lg"
                  size="lg" disabled={loading} onClick={handleAdvance}>
                  <ChevronUp className="w-5 h-5 mr-1" />
                  {loading ? "Climbing…" : `Attempt Level ${currentLevel + 1}`}
                </Button>
                {currentLevel > 0 && (
                  <Button variant="outline" className="w-full border-amber-500/30 text-amber-300 hover:bg-amber-500/10 font-bold"
                    size="lg" disabled={loading} onClick={handleCashOut}>
                    <TrendingUp className="w-4 h-4 mr-1.5" />
                    Cash Out — {formatCurrency(potentialPayout)}
                  </Button>
                )}
              </>
            )}

            {/* Failed */}
            {phase === "failed" && (
              <>
                <div className="text-center space-y-3 py-4">
                  <p className="text-5xl">💀</p>
                  <p className="text-xl font-display font-bold text-red-400">Failed at Level {failedAtLevel}</p>
                  <p className="text-muted-foreground text-sm">Lost {formatCurrency(activeBet)}</p>
                  {currentLevel > 0 && (
                    <p className="text-xs text-muted-foreground">You had survived up to Level {currentLevel}.</p>
                  )}
                </div>
                <Button className="w-full font-bold" size="lg" onClick={reset}>🔄 Try Again</Button>
              </>
            )}

            {/* Cashed Out */}
            {phase === "cashedOut" && (
              <>
                <div className="text-center space-y-3 py-4">
                  <p className="text-5xl">💰</p>
                  <p className="text-xl font-display font-bold text-amber-300">Cashed Out at Level {currentLevel}!</p>
                  <p className="font-mono text-3xl font-bold text-white">+{formatCurrency(finalPayout)}</p>
                  <p className="text-xs text-muted-foreground">{PAYOUTS[currentLevel]}× multiplier on {formatCurrency(activeBet)}</p>
                </div>
                <Button className="w-full font-bold" size="lg" onClick={reset}>🔄 Play Again</Button>
              </>
            )}

            {/* Won (reached top) */}
            {phase === "won" && (
              <>
                <div className="text-center space-y-3 py-4">
                  <motion.p className="text-5xl" animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: 3 }}>🏆</motion.p>
                  <p className="text-xl font-display font-bold text-amber-300">Summit Reached!</p>
                  <p className="font-mono text-3xl font-bold text-amber-200">+{formatCurrency(finalPayout)}</p>
                  <p className="text-xs text-muted-foreground">960× multiplier — Maximum possible win!</p>
                </div>
                <Button className="w-full font-bold bg-amber-600 hover:bg-amber-500 text-black" size="lg" onClick={reset}>🔄 Play Again</Button>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
