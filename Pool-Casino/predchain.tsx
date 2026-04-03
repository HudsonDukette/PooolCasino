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

export default function PredChain() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [rounds, setRounds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(5);
  const [currentMult, setCurrentMult] = useState(1);
  const [history, setHistory] = useState<{ prediction: string; outcome: string; correct: boolean }[]>([]);
  const [result, setResult] = useState<any>(null);

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true); setResult(null); setHistory([]); setCorrect(0); setCurrentMult(1);
    try {
      const res = await fetch(`${BASE}api/predchain/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, rounds, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTotal(data.totalRounds); setPhase("playing");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handlePredict(prediction: "heads" | "tails") {
    if (loading || phase !== "playing") return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/predchain/predict`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setHistory(prev => [...prev, { prediction, outcome: data.outcome, correct: data.correct }]);
      if (data.bust) {
        setPhase("done"); setResult(data);
        toast({ title: `❌ Wrong! Lost ${formatCurrency(parseFloat(betAmount))}`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else if (data.finished) {
        setPhase("done"); setResult(data); setCorrect(data.correct_count); setCurrentMult(data.multiplier);
        toast({ title: `🎉 All correct! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else {
        setCorrect(data.correct_count); setCurrentMult(data.currentMult);
        toast({ title: `✅ Correct! ${data.remaining} to go`, className: "bg-success text-success-foreground border-none" });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell casinoId={casinoId} gameType="predchain" payTableEntries={GAME_PAY_TABLES.predchain} title="Prediction Chain" description="Predict a series of coin flips. All correct = huge multiplier! One wrong = lose everything." accentColor="text-indigo-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            {phase === "idle" || phase === "done" ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
                  <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Number of predictions</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 4, 5].map(n => (
                      <button key={n} onClick={() => setRounds(n)}
                        className={`h-12 rounded-xl border-2 font-bold text-lg transition-all ${rounds === n ? "border-indigo-500 bg-indigo-500/20 text-indigo-300" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30"}`}>
                        {n}
                        <div className="text-xs font-normal opacity-70">{(Math.pow(1.85, n)).toFixed(1)}×</div>
                      </button>
                    ))}
                  </div>
                </div>
                <Button className="w-full font-bold" size="lg" disabled={loading} onClick={handleStart}
                  style={{ background: "linear-gradient(135deg,#4f46e5,#3730a3)", boxShadow: "0 0 20px rgba(79,70,229,0.3)" }}>
                  {loading ? "Starting…" : "🔮 Start Prediction"}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-black text-indigo-400">{correct}/{total} correct</div>
                  <div className="text-sm text-muted-foreground">Current multiplier: {currentMult.toFixed(2)}×</div>
                </div>
                <div className="flex gap-2 justify-center">
                  {history.map((h, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${h.correct ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                      {h.correct ? "✓" : "✗"}
                    </div>
                  ))}
                  {Array.from({ length: total - history.length }, (_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center text-muted-foreground text-xs">?</div>
                  ))}
                </div>
                <p className="text-center text-muted-foreground text-sm">What's the next flip?</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handlePredict("heads")} disabled={loading} className="h-16 text-xl font-bold bg-yellow-600 hover:bg-yellow-500">
                    🟡 Heads
                  </Button>
                  <Button onClick={() => handlePredict("tails")} disabled={loading} className="h-16 text-xl font-bold bg-gray-600 hover:bg-gray-500">
                    ⚫ Tails
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
                  <div className="text-6xl">{result.won ? "🔮" : "❌"}</div>
                  <div className={`text-3xl font-black ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : `−${formatCurrency(parseFloat(betAmount))}`}
                  </div>
                  <p className="text-muted-foreground text-sm">{result.bust ? `Wrong on prediction ${result.correct_count + 1}` : `All ${result.correct_count} correct! ${result.multiplier}×`}</p>
                </motion.div>
              ) : phase === "playing" ? (
                <motion.div key="playing" className="text-center space-y-3">
                  <motion.div animate={{ opacity: [1, 0.6, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-6xl">🔮</motion.div>
                  <p className="text-indigo-400 font-bold">{total - correct} predictions left</p>
                  <p className="text-muted-foreground text-sm">All correct = {(Math.pow(1.85, total)).toFixed(1)}× multiplier</p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center space-y-3">
                  <div className="text-6xl">🔮</div>
                  <p className="text-muted-foreground text-sm">Predict a series of coin flips</p>
                  <div className="text-xs text-muted-foreground/60 space-y-1">
                    <p>3 correct: 6.3× · 4: 11.7× · 5: 21.7×</p>
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
