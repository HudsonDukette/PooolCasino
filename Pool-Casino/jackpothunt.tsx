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

export default function JackpotHunt() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [picks, setPicks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const togglePick = (n: number) => {
    setPicks(prev => prev.includes(n) ? prev.filter(p => p !== n) : prev.length < 3 ? [...prev, n] : prev);
  };

  async function handlePlay() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (picks.length !== 3) { toast({ title: "Pick exactly 3 boxes", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${BASE}api/jackpothunt`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, picks, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `📦 ${data.avgMultiplier.toFixed(2)}× avg! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `📦 ${data.avgMultiplier.toFixed(2)}× avg. Lost ${formatCurrency(bet)}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); setPicks([]); }
  }

  const getBoxColor = (box: any) => {
    if (!box.picked) return "border-white/10 bg-black/20 text-muted-foreground";
    if (box.multiplier >= 5) return "border-yellow-500 bg-yellow-500/20 text-yellow-300";
    if (box.multiplier >= 2) return "border-emerald-500 bg-emerald-500/20 text-emerald-300";
    if (box.multiplier >= 1) return "border-blue-500 bg-blue-500/20 text-blue-300";
    return "border-red-500 bg-red-500/10 text-red-400";
  };

  return (
    <GameShell casinoId={casinoId} gameType="jackpothunt" payTableEntries={GAME_PAY_TABLES.jackpothunt} title="Jackpot Hunt" description="Hunt through 12 mystery boxes. Pick 3 — one might hold the jackpot! Average multiplier of your picks determines your payout." accentColor="text-yellow-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Select 3 boxes ({picks.length}/3)</p>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
                  const box = result?.boxes.find((b: any) => b.box === n);
                  return (
                    <button key={n} disabled={loading || !!result} onClick={() => togglePick(n)}
                      className={`h-14 rounded-xl border-2 font-bold text-sm transition-all ${
                        result ? getBoxColor(box) : picks.includes(n) ? "border-yellow-500 bg-yellow-500/20 text-yellow-300" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30"
                      } disabled:cursor-default`}>
                      {result ? (box?.picked ? `${box.multiplier}×` : "—") : (picks.includes(n) ? "📦" : n)}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button className="w-full font-bold" size="lg" disabled={loading || picks.length !== 3 || !!result} onClick={handlePlay}
              style={{ background: "linear-gradient(135deg,#d97706,#92400e)", boxShadow: "0 0 20px rgba(217,119,6,0.3)" }}>
              {loading ? "Opening…" : "📦 Open 3 Boxes"}
            </Button>
            {result && <Button variant="outline" className="w-full" onClick={() => { setResult(null); setPicks([]); }}>Play Again</Button>}
          </CardContent>
        </Card>
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[250px]">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3">
                  <div className="text-6xl">{result.avgMultiplier >= 2 ? "🎉" : result.avgMultiplier >= 1 ? "📦" : "💀"}</div>
                  <div className="text-lg text-muted-foreground">Avg multiplier: <span className="text-white font-bold">{result.avgMultiplier.toFixed(2)}×</span></div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {result.pickedValues.map((v: number, i: number) => (
                      <span key={i} className="mr-2">Box {result.picks[i]}: {v}×</span>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">📦</div>
                  <p className="text-muted-foreground text-sm">{picks.length}/3 boxes selected</p>
                  <div className="text-xs text-muted-foreground/60 space-y-1">
                    <p>Jackpot box: 10× · Good: 2-3× · Empty: 0×</p>
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
