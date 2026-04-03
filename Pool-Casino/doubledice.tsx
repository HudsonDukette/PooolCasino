import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-doubledice.png";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = import.meta.env.BASE_URL;

const DOTS: Record<number, number[][]> = {
  1: [[50,50]],
  2: [[25,25],[75,75]],
  3: [[25,25],[50,50],[75,75]],
  4: [[25,25],[75,25],[25,75],[75,75]],
  5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
  6: [[25,22],[75,22],[25,50],[75,50],[25,78],[75,78]],
};

function Die({ value, rolling = false }: { value: number; rolling?: boolean }) {
  const dots = DOTS[value] ?? [];
  return (
    <motion.div
      animate={rolling ? { rotate: [0, 180, 360], scale: [1, 0.8, 1] } : {}}
      transition={{ duration: 0.4 }}
      className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-white/20 relative shadow-xl"
    >
      {dots.map(([x, y], i) => (
        <div key={i} className="absolute w-3 h-3 rounded-full bg-white shadow-sm"
          style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)" }} />
      ))}
    </motion.div>
  );
}

const SUM_PAYOUTS: Record<number, string> = {2:"18×",12:"18×",3:"10×",11:"10×",4:"7×",10:"7×",5:"5.5×",9:"5.5×",6:"4.5×",8:"4.5×",7:"4×"};
const SUMS = [2,3,4,5,6,7,8,9,10,11,12];

export default function DoubleDice() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [betType, setBetType] = useState<string>("even");
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [dice, setDice] = useState([1, 1]);
  const [result, setResult] = useState<any>(null);

  async function handleRoll() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    setRolling(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}api/games/doubledice`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, betType, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTimeout(() => {
        setDice([data.die1, data.die2]);
        setRolling(false);
        setResult(data);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        if (data.won) toast({ title: `🎲 You win! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
        else toast({ title: `Rolled ${data.sum}. Lost ${formatCurrency(bet)}`, variant: "destructive" });
      }, 400);
    } catch (err: unknown) {
      setRolling(false);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell casinoId={casinoId} gameType="doubledice" payTableEntries={GAME_PAY_TABLES.doubledice} heroImage={heroImg} title="Double Dice" description="Roll two dice. Bet on even/odd or pick an exact sum for bigger payouts." accentColor="text-yellow-400" backHref={casinoId !== undefined ? `/casino/${casinoId}` : "/games"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet On</p>
              <div className="grid grid-cols-2 gap-2">
                {(["even","odd"] as const).map(t => (
                  <button key={t} disabled={loading} onClick={() => setBetType(t)}
                    className={`px-4 py-2.5 rounded-xl border font-medium text-sm transition-all capitalize ${
                      betType === t ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300" : "bg-black/30 border-white/10 text-muted-foreground hover:border-white/20"
                    }`}>
                    {t === "even" ? "⚪ Even (1.9×)" : "⚫ Odd (1.9×)"}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mt-2">Or exact sum:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUMS.map(s => (
                    <button key={s} disabled={loading} onClick={() => setBetType(String(s))}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                        betType === String(s) ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-black/30 border-white/10 text-muted-foreground hover:border-white/20"
                      }`}>
                      {s}<div className="text-[9px] opacity-70">{SUM_PAYOUTS[s]}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button className="w-full bg-yellow-600/90 hover:bg-yellow-500 text-black font-bold"
              size="lg" disabled={loading} onClick={handleRoll}>
              {loading ? "Rolling…" : "🎲 Roll Dice"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-6 min-h-[260px]">
            <div className="flex gap-6">
              <Die value={dice[0]} rolling={rolling} />
              <Die value={dice[1]} rolling={rolling} />
            </div>
            <AnimatePresence>
              {result && !rolling && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
                  <p className="text-2xl font-display font-bold text-white">Sum: {result.sum} <span className={result.sum % 2 === 0 ? "text-emerald-400" : "text-orange-400"}>({result.sum % 2 === 0 ? "Even" : "Odd"})</span></p>
                  <div className={`text-lg font-bold ${result.won ? "text-emerald-300" : "text-red-400"}`}>
                    {result.won ? `+${formatCurrency(result.payout)}` : "No win"}
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
