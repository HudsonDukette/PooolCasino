import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-target.png";
import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

const TARGETS = [
  { value: 1.5, label: "1.5×", winPct: "64%", color: "text-green-400", border: "border-green-500/40", bg: "bg-green-500/10" },
  { value: 2,   label: "2×",   winPct: "48%", color: "text-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10" },
  { value: 3,   label: "3×",   winPct: "32%", color: "text-cyan-400",    border: "border-cyan-500/40",    bg: "bg-cyan-500/10" },
  { value: 5,   label: "5×",   winPct: "19%", color: "text-blue-400",    border: "border-blue-500/40",    bg: "bg-blue-500/10" },
  { value: 10,  label: "10×",  winPct: "9.6%", color: "text-purple-400",  border: "border-purple-500/40",  bg: "bg-purple-500/10" },
  { value: 25,  label: "25×",  winPct: "3.8%", color: "text-pink-400",    border: "border-pink-500/40",    bg: "bg-pink-500/10" },
  { value: 50,  label: "50×",  winPct: "1.9%", color: "text-red-400",     border: "border-red-500/40",     bg: "bg-red-500/10" },
];

export default function Target() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("100");
  const [target, setTarget] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const selected = TARGETS.find(t => t.value === target) ?? TARGETS[1];

  async function handlePlay() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}api/games/target`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      if (data.won) toast({ title: `🎯 Hit! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `Miss. Lost ${formatCurrency(bet)}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell heroImage={heroImg} title="Target Multiplier" description="Pick a multiplier target. The higher the target, the harder the hit — but the bigger the reward." accentColor="text-blue-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Target Multiplier</p>
              <div className="grid grid-cols-4 gap-2">
                {TARGETS.map(t => (
                  <button key={t.value} disabled={loading} onClick={() => setTarget(t.value)}
                    className={`px-2 py-2 rounded-xl border text-sm font-bold transition-all ${
                      target === t.value ? `${t.bg} ${t.border} ${t.color}` : "bg-black/30 border-white/10 text-muted-foreground hover:border-white/20"
                    } disabled:opacity-40`}>
                    {t.label}
                    <div className="text-[10px] opacity-70 font-normal">{t.winPct}</div>
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handlePlay}
              style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", boxShadow: "0 0 20px rgba(59,130,246,0.3)" }}>
              {loading ? "Rolling…" : `🎯 Aim for ${selected.label}`}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[250px]">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ type: "spring", stiffness: 260, damping: 15 }}
                    className="text-7xl"
                  >
                    {result.won ? "🎯" : "💨"}
                  </motion.div>
                  <div className={`text-3xl font-display font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {result.won ? `Hit the ${target}× target!` : `Missed. Win chance was ${result.winProb}%`}
                  </p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className={`text-6xl font-display font-black ${selected.color}`}>{selected.label}</div>
                  <p className="text-muted-foreground text-sm">{selected.winPct} win chance</p>
                  <p className="text-xs text-muted-foreground/60">Pick your target and place your bet</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
