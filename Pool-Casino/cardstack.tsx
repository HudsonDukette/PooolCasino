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

export default function CardStack() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [cards, setCards] = useState<{ label: string; value: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<any>(null);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setCards([]); setTotal(0);
    try {
      const res = await fetch(`${BASE}api/cardstack/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCards([data.card]); setTotal(data.total); setPhase("playing");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleDraw() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/cardstack/draw`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCards(prev => [...prev, data.card]); setTotal(data.total);
      if (data.bust) {
        setPhase("done"); setResult(data);
        toast({ title: `💥 Bust at ${data.total}! Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleStand() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/cardstack/stand`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPhase("done"); setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `🃏 Stand at ${data.total}! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `🃏 Stand at ${data.total} · ${data.multiplier}×. Lost.`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const totalColor = total > 18 ? "text-emerald-400" : total > 15 ? "text-yellow-400" : total > 10 ? "text-blue-400" : "text-muted-foreground";

  return (
    <GameShell casinoId={casinoId} gameType="cardstack" payTableEntries={GAME_PAY_TABLES.cardstack} title="Card Stack" description="Draw cards to get as close to 21 as possible without busting. Higher totals = bigger multipliers. Stand to cash out!" accentColor="text-purple-400">
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
                  <p>21 → 3× · 20 → 2.5× · 19 → 2× · 18 → 1.8×</p>
                  <p>17 → 1.5× · 16 → 1.3× · Bust over 21 → 0×</p>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 0 20px rgba(124,58,237,0.3)" }}>
                  {loading ? "Dealing…" : "🃏 Deal First Card"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className={`text-5xl font-black ${totalColor}`}>{total}</div>
                  <div className="text-sm text-muted-foreground">Total ({cards.length} cards)</div>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {cards.map((c, i) => (
                    <motion.div key={i} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} className="bg-white text-black px-3 py-2 rounded-lg font-bold text-sm shadow">
                      {c.label}
                    </motion.div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button className="h-12 font-bold bg-purple-600 hover:bg-purple-500" disabled={loading} onClick={handleDraw}>
                    🃏 Draw
                  </Button>
                  <Button variant="outline" className="h-12 font-bold" disabled={loading || cards.length === 0} onClick={handleStand}>
                    ✋ Stand
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[250px]">
            <AnimatePresence mode="wait">
              {phase === "done" && result ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3">
                  <div className="text-6xl">{result.bust ? "💥" : result.won ? "🎉" : "📉"}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">{result.bust ? `Bust at ${result.total}` : `Total: ${result.total} · ${result.multiplier}×`}</p>
                </motion.div>
              ) : phase === "playing" ? (
                <motion.div key="playing" className="text-center space-y-3">
                  <div className={`text-6xl font-black ${totalColor}`}>{total}</div>
                  <p className="text-muted-foreground text-sm">Draw or stand?</p>
                  <p className="text-xs text-muted-foreground/60">{22 - total - 1} more points before bust</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🃏</div>
                  <p className="text-muted-foreground text-sm">Get as close to 21 as possible</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
