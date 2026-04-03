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
type Phase = "idle" | "playing" | "bust" | "cashed";

export default function ChainReaction() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [chain, setChain] = useState(0);
  const [currentMult, setCurrentMult] = useState(1);
  const [nextWinChance, setNextWinChance] = useState(0);
  const [finalPayout, setFinalPayout] = useState<any>(null);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setFinalPayout(null);
    try {
      const res = await fetch(`${BASE}api/chainreaction/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setChain(0); setCurrentMult(1); setNextWinChance(0.7); setPhase("playing");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleReact() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/chainreaction/react`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.bust) {
        setPhase("bust"); setFinalPayout(data);
        toast({ title: "💥 Chain broken!", variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else {
        setChain(data.chainLength); setCurrentMult(data.currentMult); setNextWinChance(data.nextWinChance);
        toast({ title: `⚡ Chain x${data.chainLength}! Mult: ${data.currentMult}×`, className: "bg-success text-success-foreground border-none" });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/chainreaction/cashout`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("cashed"); setFinalPayout(data);
      toast({ title: `💰 Cashed out at ${data.multiplier}×! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell casinoId={casinoId} gameType="chainreaction" payTableEntries={GAME_PAY_TABLES.chainreaction} title="Chain Reaction" description="Start a chain — each reaction grows your multiplier. But each reaction is riskier. Cash out before the chain breaks!" accentColor="text-orange-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase === "idle" || phase === "bust" || phase === "cashed" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#ea580c,#b45309)", boxShadow: "0 0 20px rgba(234,88,12,0.3)" }}>
                  {loading ? "Starting…" : "⚡ Start Chain"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <div className="text-4xl font-black text-orange-400">{currentMult}×</div>
                  <div className="text-sm text-muted-foreground mt-1">Current multiplier</div>
                  <div className="text-xs text-muted-foreground mt-1">Chain length: {chain}</div>
                </div>
                <div className="text-sm text-center text-muted-foreground">
                  Next reaction win chance: <span className="text-white font-bold">{Math.round(nextWinChance * 100)}%</span>
                </div>
                <Button className="w-full h-12 font-bold text-lg bg-orange-600 hover:bg-orange-500" disabled={loading} onClick={handleReact}>
                  {loading ? "Reacting…" : "⚡ React!"}
                </Button>
                <Button variant="outline" className="w-full" disabled={loading || chain === 0} onClick={handleCashout}>
                  💰 Cash Out ({currentMult}×)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[250px]">
            <AnimatePresence mode="wait">
              {(phase === "bust" || phase === "cashed") && finalPayout ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3">
                  <div className="text-6xl">{phase === "cashed" ? "💰" : "💥"}</div>
                  <div className={`text-3xl font-black ${finalPayout.won ? "text-emerald-300" : "text-red-400"}`}>
                    {finalPayout.won ? `+${formatCurrency(finalPayout.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">{phase === "cashed" ? `Cashed at ${finalPayout.multiplier}× after ${finalPayout.chainLength} links` : `Chain broke after ${finalPayout.chainLength} links`}</p>
                </motion.div>
              ) : phase === "playing" ? (
                <motion.div key="playing" className="text-center space-y-3">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-6xl">⚡</motion.div>
                  <p className="text-white font-bold text-xl">Chain: {chain} links</p>
                  <p className="text-muted-foreground text-sm">Keep going or cash out!</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">⛓️</div>
                  <p className="text-muted-foreground text-sm">Start a chain reaction</p>
                  <div className="text-xs text-muted-foreground/60 space-y-1">
                    <p>1 link: 1.6× · 3 links: 2.8×</p>
                    <p>5 links: 4× · 8 links: 5.8×</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
