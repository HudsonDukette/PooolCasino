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
type Phase = "idle" | "playing" | "done";

export default function PowerGrid() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealed, setRevealed] = useState<Record<number, any>>({});
  const [accumulated, setAccumulated] = useState(1);
  const [result, setResult] = useState<any>(null);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setRevealed({}); setAccumulated(1);
    try {
      const res = await fetch(`${BASE}api/powergrid/start`, {
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

  async function handlePick(cell: number) {
    if (revealed[cell] || phase !== "playing" || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/powergrid/pick`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cell }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRevealed(prev => ({ ...prev, [cell]: data.revealed }));
      if (data.bust) {
        setPhase("done"); setResult(data);
        toast({ title: `⚡ Shock! Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else {
        setAccumulated(data.accumulated);
        toast({ title: `⚡ ${data.revealed.multiplier}× tile! Acc: ${data.accumulated}×`, className: "bg-success text-success-foreground border-none" });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/powergrid/cashout`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("done"); setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `⚡ Powered up! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `No gain. Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const getCellStyle = (i: number) => {
    const r = revealed[i];
    if (!r) return "bg-black/20 border-white/10 hover:border-yellow-500/50 cursor-pointer";
    if (r.type === "shock") return "bg-red-500/30 border-red-500 cursor-default";
    if (r.type === "bonus") return "bg-yellow-500/30 border-yellow-500 cursor-default";
    if (r.type === "boost") return "bg-blue-500/30 border-blue-500 cursor-default";
    return "bg-gray-500/20 border-gray-500/50 cursor-default";
  };

  return (
    <GameShell casinoId={casinoId} gameType="powergrid" payTableEntries={GAME_PAY_TABLES.powergrid} title="Power Grid" description="Reveal tiles on a 4×4 grid to charge up your multiplier. Avoid shock tiles! Cash out any time." accentColor="text-yellow-400">
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
                  <p>Bonus tiles: 2.5–3× · Boost tiles: 1.1–1.8×</p>
                  <p>Weak tiles: 0.3–0.8× · 4 shock tiles lose all</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#ca8a04,#92400e)", boxShadow: "0 0 20px rgba(202,138,4,0.3)" }}>
                  {loading ? "Charging…" : "⚡ Power Up Grid"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-black text-yellow-400">{accumulated.toFixed(3)}×</div>
                  <div className="text-sm text-muted-foreground">Accumulated multiplier</div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 16 }, (_, i) => {
                    const r = revealed[i];
                    return (
                      <button key={i} onClick={() => handlePick(i)} disabled={!!r || loading}
                        className={`h-12 rounded-lg border-2 text-xs font-bold transition-all ${getCellStyle(i)}`}>
                        {r ? (r.type === "shock" ? "⚡💥" : `${r.multiplier}×`) : "?"}
                      </button>
                    );
                  })}
                </div>
                <Button variant="outline" className="w-full" disabled={loading || Object.keys(revealed).length === 0} onClick={handleCashout}>
                  💰 Cash Out ({accumulated.toFixed(3)}×)
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
                  <div className="text-6xl">{result.bust ? "💥" : result.won ? "⚡" : "📉"}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">{result.bust ? "Hit a shock tile!" : `Cashed at ${result.accumulated}×`}</p>
                </motion.div>
              ) : phase === "playing" ? (
                <motion.div key="playing" className="text-center space-y-3">
                  <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl">⚡</motion.div>
                  <p className="text-yellow-400 font-bold">{accumulated.toFixed(3)}× charged</p>
                  <p className="text-muted-foreground text-sm">Pick tiles to power up!</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🔋</div>
                  <p className="text-muted-foreground text-sm">Reveal tiles to multiply your bet</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
