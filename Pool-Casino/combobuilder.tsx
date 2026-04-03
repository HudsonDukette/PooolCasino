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

export default function ComboBuilder() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [combo, setCombo] = useState(0);
  const [roundMult, setRoundMult] = useState(1);
  const [lastResult, setLastResult] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setLastResult(null); setCombo(0); setRoundMult(1);
    try {
      const res = await fetch(`${BASE}api/combobuilder/start`, {
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

  async function handlePick(pick: number) {
    if (loading || phase !== "playing") return;
    setLoading(true); setLastResult(null);
    try {
      const res = await fetch(`${BASE}api/combobuilder/pick`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLastResult(data);
      if (data.bust) {
        setPhase("done"); setResult(data);
        toast({ title: `💥 Wrong choice! Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else {
        setCombo(data.combo); setRoundMult(data.roundMult);
        toast({ title: `🔥 Combo x${data.combo}! Mult: ${data.roundMult}×`, className: "bg-success text-success-foreground border-none" });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/combobuilder/cashout`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("done"); setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `🔥 Combo x${data.combo}! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell casinoId={casinoId} gameType="combobuilder" payTableEntries={GAME_PAY_TABLES.combobuilder} title="Combo Builder" description="Pick 1 of 3 options each round. 1 is a bust — avoid it! Each correct pick extends your combo and multiplier. Cash out to secure your winnings." accentColor="text-orange-400">
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
                  <p>Combo 1: 1.5× · Combo 3: 2.5× · Combo 5: 4×</p>
                  <p>1 of 3 options is always a bust (~33%)</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#ea580c,#b45309)", boxShadow: "0 0 20px rgba(234,88,12,0.3)" }}>
                  {loading ? "Starting…" : "🔥 Start Combo"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-black text-orange-400">🔥 Combo x{combo}</div>
                  <div className="text-sm text-muted-foreground">Multiplier: {roundMult}×</div>
                </div>
                {lastResult && (
                  <div className="text-center text-sm">
                    <span className={lastResult.hit ? "text-emerald-400" : "text-red-400"}>
                      {lastResult.hit ? `✓ Safe!` : `✗ Bust was #${lastResult.bustIndex}`}
                    </span>
                  </div>
                )}
                <p className="text-center text-muted-foreground text-sm">Choose wisely — 1 of 3 is a bust</p>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map(n => (
                    <Button key={n} disabled={loading} onClick={() => handlePick(n)}
                      className="h-16 text-2xl font-black bg-orange-600 hover:bg-orange-500">
                      {n}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" className="w-full" disabled={loading || combo === 0} onClick={handleCashout}>
                  💰 Cash Out ({roundMult}×)
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
                  <div className="text-6xl">{result.bust ? "💥" : "🔥"}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">{result.bust ? `Busted at combo x${result.combo}` : `Cashed at combo x${result.combo} (${result.multiplier}×)`}</p>
                </motion.div>
              ) : phase === "playing" ? (
                <motion.div key="playing" className="text-center space-y-3">
                  <motion.div animate={{ scale: combo > 0 ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.3 }} className="text-6xl">🔥</motion.div>
                  <p className="text-orange-400 font-black text-2xl">x{combo} Combo</p>
                  <p className="text-muted-foreground text-sm">Current payout: {roundMult}×</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🎯</div>
                  <p className="text-muted-foreground text-sm">Build a combo chain</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
