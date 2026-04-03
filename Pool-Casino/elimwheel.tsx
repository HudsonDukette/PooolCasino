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
type Phase = "idle" | "spinning" | "done";

export default function ElimWheel() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [segments, setSegments] = useState<number[]>([]);
  const [round, setRound] = useState(0);
  const [lastLanded, setLastLanded] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);
  const [spinning, setSpinning] = useState(false);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setRound(0); setLastLanded(null);
    try {
      const res = await fetch(`${BASE}api/elimwheel/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSegments(data.segments); setPhase("spinning");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleSpin() {
    if (loading || spinning) return;
    setSpinning(true);
    await new Promise(r => setTimeout(r, 800));
    setSpinning(false);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/elimwheel/spin`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLastLanded(data.landed); setRound(data.round);
      if (data.finished) {
        setPhase("done"); setResult(data); setSegments([]);
        toast({ title: `🎡 Last spin! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else {
        setSegments(data.remaining);
        toast({ title: `🎡 Eliminated ${data.landed}! ${data.remaining.length} left`, className: "bg-success text-success-foreground border-none" });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/elimwheel/cashout`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("done"); setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `💰 Cashed out! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `Cashed out early. Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const MULT_TABLE = [0, 0.3, 0.6, 1.0, 1.5, 2.5, 4, 5];
  const currentEst = MULT_TABLE[Math.min(round, MULT_TABLE.length - 1)];

  return (
    <GameShell casinoId={casinoId} gameType="elimwheel" payTableEntries={GAME_PAY_TABLES.elimwheel} title="Elimination Wheel" description="Spin the wheel — each spin eliminates one segment. Last segment standing wins the jackpot! Cash out early for smaller rewards." accentColor="text-pink-400">
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
                  <p>3 spins: 1× · 5 spins: 2.5× · 7 spins: 5×</p>
                  <p>Survive all 8 spins: 5×</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#db2777,#9d174d)", boxShadow: "0 0 20px rgba(219,39,119,0.3)" }}>
                  {loading ? "Loading…" : "🎡 Start Wheel"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-black text-pink-400">Round {round} · {segments.length} segments left</div>
                  <div className="text-sm text-muted-foreground">Cashout value: {currentEst}×</div>
                </div>
                {lastLanded !== null && (
                  <div className="text-center text-sm text-muted-foreground">
                    Last eliminated: <span className="text-red-400 font-bold">#{lastLanded}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-center">
                  {segments.map(s => (
                    <div key={s} className="bg-pink-500/20 border border-pink-500/50 rounded-lg px-3 py-1 text-pink-300 font-bold text-sm">{s}</div>
                  ))}
                </div>
                <Button className="w-full h-12 font-bold bg-pink-600 hover:bg-pink-500" disabled={loading || spinning} onClick={handleSpin}>
                  {spinning ? "Spinning…" : "🎡 Spin!"}
                </Button>
                <Button variant="outline" className="w-full" disabled={loading || round === 0} onClick={handleCashout}>
                  💰 Cash Out ({currentEst}×)
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
                  <div className="text-6xl">{result.won ? "🎡" : "📉"}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">{result.finished ? "All segments eliminated!" : `Cashed at round ${result.spunRounds}`}</p>
                </motion.div>
              ) : phase === "spinning" ? (
                <motion.div key="spinning" className="text-center space-y-3">
                  <motion.div animate={spinning ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: spinning ? Infinity : 0 }} className="text-6xl">🎡</motion.div>
                  <p className="text-pink-400 font-semibold">{segments.length} segments remain</p>
                  <p className="text-muted-foreground text-sm">Eliminate all 8 for max payout</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🎡</div>
                  <p className="text-muted-foreground text-sm">8 segments on the wheel</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
