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

export default function HiddenPath() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [choices, setChoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const toggleChoice = (i: number, dir: "left" | "right") => {
    setChoices(prev => { const a = [...prev]; a[i] = dir; return a; });
  };

  async function handlePlay() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (choices.length !== 5 || choices.some(c => !c)) { toast({ title: "Make all 5 choices", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${BASE}api/hiddenpath`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, choices, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.won) toast({ title: `🌿 ${data.hits}/5 correct! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else toast({ title: `❌ ${data.hits}/5 correct. Lost ${formatCurrency(bet)}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell casinoId={casinoId} gameType="hiddenpath" payTableEntries={GAME_PAY_TABLES.hiddenpath} title="Hidden Path" description="Navigate 5 hidden junctions. Go left or right — the correct path is revealed after your choices." accentColor="text-green-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground font-medium">Your Path Choices</p>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm w-12">Step {i + 1}</span>
                  <div className="flex gap-2 flex-1">
                    {["left", "right"].map(dir => (
                      <button key={dir} disabled={loading} onClick={() => toggleChoice(i, dir as "left" | "right")}
                        className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all capitalize ${choices[i] === dir ? "border-green-500 bg-green-500/20 text-green-300" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30"} disabled:opacity-40`}>
                        {dir === "left" ? "◀ Left" : "Right ▶"}
                      </button>
                    ))}
                  </div>
                  {result && (
                    <span className={`text-sm font-bold ${result.steps[i]?.hit ? "text-emerald-400" : "text-red-400"}`}>
                      {result.steps[i]?.hit ? "✓" : "✗"}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <Button className="w-full font-bold" size="lg" disabled={loading || choices.length < 5} onClick={handlePlay}
              style={{ background: "linear-gradient(135deg,#059669,#065f46)", boxShadow: "0 0 20px rgba(5,150,105,0.3)" }}>
              {loading ? "Revealing…" : "🌿 Take the Path"}
            </Button>
          </CardContent>
        </Card>
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[250px]">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 w-full">
                  <div className="text-6xl">{result.hits >= 3 ? "🌟" : "💀"}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground">{result.hits}/5 junctions correct · {result.multiplier}× multiplier</p>
                  <div className="flex gap-1 justify-center">
                    {result.steps.map((s: any, i: number) => (
                      <span key={i} className={`text-xl ${s.hit ? "text-emerald-400" : "text-red-400"}`}>{s.hit ? "✓" : "✗"}</span>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🌿</div>
                  <p className="text-muted-foreground text-sm">{choices.filter(Boolean).length}/5 choices made</p>
                  <div className="text-xs text-muted-foreground/60 space-y-1">
                    <p>3 correct → 1.5× · 4 correct → 2.5×</p>
                    <p>5 correct → 5×</p>
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
