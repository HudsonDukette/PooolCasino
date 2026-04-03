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

export default function BlindDraw() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [pick, setPick] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handlePlay() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (!pick) { toast({ title: "Pick a card first", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${BASE}api/blinddraw`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, pick, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `🃏 ${data.card.label}! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `🃏 ${data.card.label}. Lost ${formatCurrency(bet)}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); setPick(null); }
  }

  return (
    <GameShell casinoId={casinoId} gameType="blinddraw" payTableEntries={GAME_PAY_TABLES.blinddraw} title="Blind Draw" description="Pick a face-down card from 8 shuffled cards. Each card has a different multiplier — or nothing." accentColor="text-purple-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Pick a card (1–8)</p>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, i) => i + 1).map(n => (
                  <button key={n} disabled={loading} onClick={() => setPick(n)}
                    className={`h-14 rounded-xl border-2 font-bold text-lg transition-all ${pick === n ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-white/10 bg-black/30 text-muted-foreground hover:border-white/30"} disabled:opacity-40`}>
                    {result ? (result.allCards[n - 1]?.picked ? (result.card.multiplier > 1 ? "🃏" : "💀") : "—") : "🂠"}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full font-bold" size="lg" disabled={loading || !pick} onClick={handlePlay}
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 0 20px rgba(124,58,237,0.3)" }}>
              {loading ? "Drawing…" : `🃏 Draw Card ${pick ?? ""}`}
            </Button>
          </CardContent>
        </Card>
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[250px]">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 w-full">
                  <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ duration: 0.4 }} className="text-7xl">🃏</motion.div>
                  <div className="text-2xl font-bold text-purple-300">{result.card.label}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {result.allCards.map((c: any, i: number) => (
                      <div key={i} className={`text-center text-xs p-1 rounded ${c.picked ? "bg-purple-500/30 text-purple-300 font-bold" : "text-muted-foreground"}`}>
                        {c.label === "?" ? "—" : c.label}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🂠</div>
                  <p className="text-muted-foreground text-sm">{pick ? `Card #${pick} selected` : "Select a card position"}</p>
                  <p className="text-xs text-muted-foreground/60">3×, 2×, 1.5×, 1.2×, 0.5×, or nothing</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
