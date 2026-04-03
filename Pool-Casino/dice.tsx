import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import { useGameApi } from "@/lib/game-api";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

// Dot positions for each face [row][col] grid (3x3, center position index = 4)
const DICE_LAYOUTS: Record<number, boolean[]> = {
  1: [false, false, false, false, true,  false, false, false, false],
  2: [true,  false, false, false, false, false, false, false, true ],
  3: [true,  false, false, false, true,  false, false, false, true ],
  4: [true,  false, true,  false, false, false, true,  false, true ],
  5: [true,  false, true,  false, true,  false, true,  false, true ],
  6: [true,  false, true,  true,  false, true,  true,  false, true ],
};

function DieFace({ value, rolling }: { value: number; rolling: boolean }) {
  const layout = DICE_LAYOUTS[value] ?? DICE_LAYOUTS[1];

  return (
    <motion.div
      animate={rolling
        ? {
            rotate: [0, -15, 15, -10, 10, -5, 5, 0],
            scale: [1, 1.05, 0.95, 1.05, 0.95, 1],
          }
        : { rotate: 0, scale: 1 }
      }
      transition={rolling
        ? { duration: 0.12, repeat: Infinity, ease: "easeInOut" }
        : { type: "spring", stiffness: 300, damping: 20 }
      }
      className="w-28 h-28 bg-white/5 rounded-2xl border-2 border-white/20 grid grid-cols-3 grid-rows-3 p-3 gap-1 shadow-[0_0_40px_rgba(0,255,170,0.15)]"
    >
      {layout.map((active, i) => (
        <div key={i} className="flex items-center justify-center">
          {active && (
            <motion.div
              initial={rolling ? false : { scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, delay: i * 0.02 }}
              className="w-4 h-4 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
            />
          )}
        </div>
      ))}
    </motion.div>
  );
}

interface DiceResult {
  won: boolean;
  rolled: number;
  payout: number;
  multiplier: number;
  newBalance: number;
  betType: string;
  prediction: number;
}

export default function Dice() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<DiceResult>();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState("10");
  const [betType, setBetType] = useState<"exact" | "high" | "low">("high");
  const [prediction, setPrediction] = useState(6);
  const [dieValue, setDieValue] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<DiceResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const bet = parseFloat(betAmount) || 0;
  const payout = betType === "exact" ? "5×" : "1.9×";

  async function handleRoll() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }

    setRolling(true);
    setResult(null);

    // Visual die tumble while waiting for result
    intervalRef.current = setInterval(() => setDieValue(Math.ceil(Math.random() * 6)), 80);

    const data = await api.call("dice", { betAmount: bet, betType, prediction, casinoId });

    // Let it roll for at least 600ms for feel
    setTimeout(() => {
      clearInterval(intervalRef.current);
      setRolling(false);
      if (!data) {
        toast({ title: "Bet failed", description: api.error ?? "Something went wrong", variant: "destructive" });
        return;
      }
      setDieValue(data.rolled);
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      toast({
        title: data.won ? `🎲 Rolled ${data.rolled}! You Win!` : `Rolled ${data.rolled}`,
        description: data.won ? `Won ${formatCurrency(data.payout)}!` : "Better luck next time",
        variant: data.won ? "default" : "destructive",
      });
    }, 700);
  }

  return (
    <GameShell casinoId={casinoId} gameType="dice" payTableEntries={GAME_PAY_TABLES.dice} title="Dice Roll" description="Pick exact or high/low — exact pays 5×, high/low pays 1.9×." accentColor="text-yellow-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Type</p>
              <div className="grid grid-cols-3 gap-2">
                {(["high", "low", "exact"] as const).map(t => (
                  <motion.div key={t} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant={betType === t ? "default" : "outline"}
                      size="sm"
                      className={`w-full capitalize border-white/10 ${betType === t ? "bg-yellow-500/80 hover:bg-yellow-400 text-black border-yellow-400" : ""}`}
                      onClick={() => setBetType(t)}
                      disabled={rolling}
                    >
                      {t}
                    </Button>
                  </motion.div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {betType === "exact" ? "Guess the exact number — 5× payout" :
                 betType === "high" ? "Roll 4, 5, or 6 — 1.9× payout" :
                 "Roll 1, 2, or 3 — 1.9× payout"}
              </p>
            </div>

            {betType === "exact" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <p className="text-sm text-muted-foreground font-medium">Your Number</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <motion.button
                      key={n}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setPrediction(n)}
                      className={`w-10 h-10 rounded-xl border font-mono font-bold text-sm transition-all ${
                        prediction === n
                          ? "border-yellow-400 bg-yellow-400/20 text-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)]"
                          : "border-white/10 bg-white/5 text-white hover:border-white/30"
                      }`}
                    >
                      {n}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={rolling || api.loading} />
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                className="w-full bg-yellow-500/90 hover:bg-yellow-400 text-black font-bold shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_30px_rgba(250,204,21,0.5)]"
                size="lg"
                disabled={rolling || api.loading}
                onClick={handleRoll}
              >
                {rolling ? "Rolling…" : `🎲 Roll (${payout} payout)`}
              </Button>
            </motion.div>
          </CardContent>
        </Card>

        {/* Die Display */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-6 min-h-[320px]">
            <DieFace value={dieValue} rolling={rolling} />

            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                  className="text-center space-y-1"
                >
                  <p className={`text-2xl font-display font-bold ${result.won ? "text-yellow-400" : "text-destructive"}`}>
                    {result.won ? "🎉 Winner!" : "No Luck"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Rolled <span className="font-mono font-bold text-white">{result.rolled}</span>
                    {" · "}
                    {result.won ? `+${formatCurrency(result.payout)}` : `-${formatCurrency(bet)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">Balance: {formatCurrency(result.newBalance)}</p>
                </motion.div>
              ) : !rolling ? (
                <motion.p key="idle" className="text-muted-foreground text-sm">
                  Press Roll to play
                </motion.p>
              ) : (
                <motion.p
                  key="rolling"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="text-yellow-400 text-sm font-medium"
                >
                  Rolling…
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
