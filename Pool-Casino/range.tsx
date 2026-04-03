import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-range.png";
import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

const RANGES = [
  { key: "narrow", label: "🎯 Narrow", range: "1 – 20", odds: "20% chance", payout: "4.75×", color: "text-red-400", border: "border-red-500/40", bg: "bg-red-500/10" },
  { key: "medium", label: "⚖️ Medium", range: "1 – 50", odds: "50% chance", payout: "1.9×",  color: "text-yellow-400", border: "border-yellow-500/40", bg: "bg-yellow-500/10" },
  { key: "wide",   label: "🌊 Upper",  range: "51 – 100", odds: "50% chance", payout: "1.9×",  color: "text-cyan-400",   border: "border-cyan-500/40",   bg: "bg-cyan-500/10" },
];

export default function RangeBet() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("100");
  const [range, setRange] = useState("narrow");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const selected = RANGES.find(r => r.key === range) ?? RANGES[0];

  async function handlePlay() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}api/games/range`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, range }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      if (data.inRange) toast({ title: `✅ In range! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `❌ Out of range (${data.number}). Lost ${formatCurrency(bet)}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell heroImage={heroImg} title="Number Range Bet" description="Pick a number range. A number 1–100 is drawn. Hit your range to win." accentColor="text-cyan-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Your Range</p>
              <div className="space-y-2">
                {RANGES.map(r => (
                  <button key={r.key} disabled={loading} onClick={() => setRange(r.key)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                      range === r.key ? `${r.bg} ${r.border}` : "bg-black/30 border-white/10 hover:border-white/20"
                    } disabled:opacity-40`}>
                    <div className="flex items-center gap-3">
                      <span className={range === r.key ? r.color : "text-muted-foreground"}>{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.range}</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono font-bold text-sm ${range === r.key ? r.color : "text-muted-foreground"}`}>{r.payout}</div>
                      <div className="text-[10px] text-muted-foreground/60">{r.odds}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full font-bold bg-cyan-600/90 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              size="lg" disabled={loading} onClick={handlePlay}>
              {loading ? "Drawing…" : `🎲 Bet on ${selected.range}`}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[250px]">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4 w-full">
                  <div className={`text-6xl font-display font-black tabular-nums ${result.inRange ? "text-cyan-300" : "text-red-400"}`}>
                    {result.number}
                  </div>
                  <div className={`flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-xl border ${
                    result.inRange ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" : "bg-red-950/40 border-red-500/30 text-red-300"
                  }`}>
                    {result.inRange ? `✅ In ${result.rangeLabel} — +${formatCurrency(result.payout)}` : `❌ Outside ${result.rangeLabel}`}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground px-2">
                    <span>Your range</span><span className="font-mono">{result.min}–{result.max}</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-2">
                  <div className="text-7xl font-display font-black text-muted-foreground/30">?</div>
                  <p className="text-muted-foreground text-sm">Number 1–100 drawn here</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
