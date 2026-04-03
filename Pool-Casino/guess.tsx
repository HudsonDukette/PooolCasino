import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import { useGameApi } from "@/lib/game-api";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

interface GuessResult {
  won: boolean;
  guessed: number;
  actual: number;
  distance: number;
  multiplier: number;
  payout: number;
  newBalance: number;
}

const PAYOUT_TABLE = [
  { cond: "Exact match", mult: "50×",  color: "text-yellow-400" },
  { cond: "Within 1",    mult: "10×",  color: "text-primary" },
  { cond: "Within 5",    mult: "3×",   color: "text-cyan-400" },
  { cond: "Within 10",   mult: "2×",   color: "text-green-400" },
  { cond: "Within 20",   mult: "1.5×", color: "text-blue-400" },
  { cond: "Off by > 20", mult: "0×",   color: "text-destructive" },
];

function AnimatedNumber({ value, active }: { value: number; active: boolean }) {
  const [display, setDisplay] = useState(value);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!active) {
      clearInterval(intervalRef.current);
      setDisplay(value);
      return;
    }
    intervalRef.current = setInterval(() => {
      setDisplay(Math.ceil(Math.random() * 100));
    }, 60);
    const timeout = setTimeout(() => {
      clearInterval(intervalRef.current);
      setDisplay(value);
    }, 800);
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeout);
    };
  }, [active, value]);

  return (
    <motion.span
      key={display}
      initial={active ? { y: -8, opacity: 0.5 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.05 }}
      className="font-mono tabular-nums"
    >
      {display}
    </motion.span>
  );
}

export default function Guess() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<GuessResult>();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState("10");
  const [guess, setGuess] = useState(50);
  const [result, setResult] = useState<GuessResult | null>(null);
  const [revealing, setRevealing] = useState(false);

  const bet = parseFloat(betAmount) || 0;

  async function handleGuess() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }

    setResult(null);
    setRevealing(true);

    const data = await api.call("guess", { betAmount: bet, guess, casinoId });

    // Animate reveal after a short delay
    setTimeout(() => {
      setRevealing(false);
      if (!data) {
        toast({ title: "Bet failed", description: api.error ?? "Something went wrong", variant: "destructive" });
        return;
      }
      if (data) {
        setResult(data);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        toast({
          title: data.distance === 0 ? "🎯 EXACT MATCH!" : data.multiplier > 0 ? `Within ${data.distance}!` : `Off by ${data.distance}`,
          description: data.won ? `Won ${formatCurrency(data.payout)}!` : `Lost ${formatCurrency(bet)}`,
          variant: data.won ? "default" : "destructive",
        });
      }
    }, 900);
  }

  return (
    <GameShell casinoId={casinoId} gameType="guess" payTableEntries={GAME_PAY_TABLES.guess} title="Number Guess" description="Pick 1–100. Closer to the secret number = bigger payout!" accentColor="text-cyan-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">Your Guess</p>
                <motion.span
                  key={guess}
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-display font-bold text-cyan-400"
                >
                  {guess}
                </motion.span>
              </div>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[guess]}
                onValueChange={([v]) => { setGuess(v); setResult(null); }}
                disabled={api.loading || revealing}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>50</span>
                <span>100</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 7, 13, 42, 50, 69, 77, 100].map(n => (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { setGuess(n); setResult(null); }}
                    className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                      guess === n
                        ? "border-cyan-400 bg-cyan-400/20 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                        : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    {n}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={api.loading || revealing} />
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                className="w-full bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                size="lg"
                disabled={api.loading || revealing}
                onClick={handleGuess}
              >
                {api.loading || revealing ? "Revealing…" : "🎯 Lock In Guess"}
              </Button>
            </motion.div>
          </CardContent>
        </Card>

        {/* Result & Paytable */}
        <div className="space-y-4">
          {/* Secret number reveal animation */}
          <AnimatePresence mode="wait">
            {(revealing || result) ? (
              <motion.div
                key={result ? "result" : "revealing"}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
              >
                <Card className={`border-2 ${
                  revealing
                    ? "border-white/20 bg-white/5"
                    : result?.won
                    ? "border-primary/40 bg-primary/5"
                    : "border-destructive/40 bg-destructive/5"
                }`}>
                  <CardContent className="p-6 space-y-4">
                    {/* Secret number reveal */}
                    <div className="text-center space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">Secret Number</p>
                      <div className="text-6xl font-display font-black text-white">
                        {revealing ? (
                          <AnimatedNumber value={result?.actual ?? 0} active={revealing} />
                        ) : (
                          <motion.span
                            initial={{ scale: 0.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            {result?.actual}
                          </motion.span>
                        )}
                      </div>
                    </div>

                    {result && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between border-t border-white/10 pt-3">
                          <div>
                            <p className={`text-xl font-display font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                              {result.distance === 0 ? "🎯 EXACT!" : result.won ? "Close Enough!" : "Too Far Off"}
                            </p>
                            <p className="text-muted-foreground text-sm">
                              You guessed <span className="font-mono font-bold text-white">{result.guessed}</span>
                              {" · "}Off by <span className="font-mono font-bold">{result.distance}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-mono font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                              {result.multiplier > 0 ? `${result.multiplier}×` : "0×"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Payout</span>
                          <span className={`font-mono font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                            {result.won ? `+${formatCurrency(result.payout)}` : `-${formatCurrency(bet)}`}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Card className="bg-card/40 border-white/10">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground font-medium">Payout Table</p>
              <div className="space-y-2">
                {PAYOUT_TABLE.map(p => (
                  <div key={p.cond} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.cond}</span>
                    <span className={`font-mono font-bold ${p.color}`}>{p.mult}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GameShell>
  );
}
