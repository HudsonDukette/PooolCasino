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

interface CrashResult {
  won: boolean;
  crashAt: number;
  cashOutAt: number;
  payout: number;
  multiplier: number;
  newBalance: number;
}

function CrashGraph({ running, crashed, progress }: { running: boolean; crashed: boolean; progress: number }) {
  const points = useRef<{ x: number; y: number }[]>([{ x: 0, y: 100 }]);

  useEffect(() => {
    if (!running) {
      points.current = [{ x: 0, y: 100 }];
    }
  }, [running]);

  const p = Math.min(progress, 1);
  const x = p * 280;
  const y = 100 - Math.pow(p, 1.5) * 90;

  const pathD = `M 10 110 Q ${x * 0.5} ${100} ${x + 10} ${y + 10}`;

  return (
    <svg viewBox="0 0 300 130" className="w-full h-32">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={crashed ? "#ef4444" : "#22c55e"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={crashed ? "#ef4444" : "#00ffaa"} stopOpacity="1" />
        </linearGradient>
      </defs>
      {running || crashed ? (
        <>
          <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" />
          {/* Glow dot */}
          {!crashed && (
            <motion.circle
              cx={x + 10}
              cy={y + 10}
              r="5"
              fill="#00ffaa"
              animate={{ r: [4, 7, 4], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          )}
          {crashed && (
            <text x={x + 10} y={y + 10} textAnchor="middle" fontSize="16" fill="#ef4444">💥</text>
          )}
        </>
      ) : (
        <line x1="10" y1="110" x2="10" y2="110" stroke="#00ffaa" strokeWidth="2" />
      )}
      {/* Axes */}
      <line x1="10" y1="10" x2="10" y2="115" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <line x1="10" y1="115" x2="295" y2="115" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    </svg>
  );
}

export default function Crash() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<CrashResult>();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState("10");
  const [cashOutAt, setCashOutAt] = useState(2);
  const [running, setRunning] = useState(false);
  const [displayMult, setDisplayMult] = useState(1.0);
  const [graphProgress, setGraphProgress] = useState(0);
  const [result, setResult] = useState<CrashResult | null>(null);
  const animRef = useRef<ReturnType<typeof setInterval>>();

  const bet = parseFloat(betAmount) || 0;

  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current); }, []);

  async function handlePlay() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }

    setRunning(true);
    setResult(null);
    setDisplayMult(1.0);
    setGraphProgress(0);

    const data = await api.call("crash", { betAmount: bet, cashOutAt, casinoId });
    if (!data) {
      setRunning(false);
      toast({ title: "Bet failed", description: api.error ?? "Something went wrong", variant: "destructive" });
      return;
    }

    const target = Math.min(data.cashOutAt, data.crashAt);
    let current = 1.0;

    animRef.current = setInterval(() => {
      current = Math.min(target, current + current * 0.025 + 0.01);
      const progress = Math.min((current - 1) / (target - 1 + 0.001), 1);
      setDisplayMult(parseFloat(current.toFixed(2)));
      setGraphProgress(progress);

      if (current >= target) {
        clearInterval(animRef.current);
        setTimeout(() => {
          setDisplayMult(parseFloat(data.cashOutAt.toFixed(2)));
          setResult(data);
          setRunning(false);
          qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
          qc.invalidateQueries({ queryKey: ["/api/pool"] });
          toast({
            title: data.won ? `🚀 Cashed out at ${data.cashOutAt}×!` : `💥 Crashed at ${data.crashAt}×`,
            description: data.won ? `Won ${formatCurrency(data.payout)}!` : `Lost ${formatCurrency(bet)}`,
            variant: data.won ? "default" : "destructive",
          });
        }, 300);
      }
    }, 50);
  }

  const crashed = result && !result.won;
  const colorClass = crashed ? "text-destructive" : running ? "text-green-400" : result?.won ? "text-primary" : "text-white/40";

  return (
    <GameShell casinoId={casinoId} gameType="crash" payTableEntries={GAME_PAY_TABLES.crash} title="Crash" description="Set your auto-cashout, then watch the rocket. Cash out before it crashes!" accentColor="text-red-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Display */}
        <Card className={`bg-black/60 border-2 transition-all duration-500 ${crashed ? "border-destructive/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]" : running ? "border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)]" : "border-white/10"}`}>
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[320px]">
            {/* Graph */}
            <div className="w-full">
              <CrashGraph running={running} crashed={!!crashed} progress={graphProgress} />
            </div>

            {/* Rocket + Multiplier */}
            <div className="flex flex-col items-center gap-2">
              <AnimatePresence mode="wait">
                {running ? (
                  <motion.div
                    key="rocket-running"
                    animate={{
                      y: [0, -6, 0],
                      rotate: [-2, 2, -2],
                    }}
                    transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
                    className="text-5xl"
                  >
                    🚀
                  </motion.div>
                ) : crashed ? (
                  <motion.div
                    key="rocket-crashed"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl"
                  >
                    💥
                  </motion.div>
                ) : result?.won ? (
                  <motion.div
                    key="rocket-won"
                    initial={{ scale: 0.5, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 250 }}
                    className="text-5xl"
                  >
                    🎉
                  </motion.div>
                ) : (
                  <motion.div key="rocket-idle" className="text-5xl opacity-30">🚀</motion.div>
                )}
              </AnimatePresence>

              <motion.div
                animate={running ? { scale: [1, 1.04, 1] } : {}}
                transition={{ duration: 0.4, repeat: Infinity }}
                className={`text-6xl font-display font-black tracking-tight ${colorClass} drop-shadow-[0_0_20px_currentColor]`}
              >
                {displayMult.toFixed(2)}×
              </motion.div>

              <AnimatePresence>
                {running && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-green-400 text-sm font-medium"
                  >
                    Climbing…
                  </motion.p>
                )}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-0.5"
                  >
                    <p className={`text-xl font-display font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                      {result.won ? `Cashed out at ${result.cashOutAt}×!` : `Crashed at ${result.crashAt}×`}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {result.won ? `Won ${formatCurrency(result.payout)}` : `Lost ${formatCurrency(bet)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">Balance: {formatCurrency(result.newBalance)}</p>
                  </motion.div>
                )}
                {!running && !result && (
                  <p className="text-muted-foreground text-sm">Set your target and launch!</p>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">Auto Cash-Out</p>
                <span className="text-xl font-mono font-bold text-primary">{cashOutAt.toFixed(1)}×</span>
              </div>
              <Slider
                min={1.1}
                max={20}
                step={0.1}
                value={[cashOutAt]}
                onValueChange={([v]) => setCashOutAt(v)}
                disabled={running || api.loading}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1.1× (Safer)</span>
                <span>20× (Riskier)</span>
              </div>
              <div className="flex gap-2">
                {[1.5, 2, 3, 5, 10].map(v => (
                  <button
                    key={v}
                    onClick={() => setCashOutAt(v)}
                    disabled={running}
                    className={`flex-1 py-1.5 rounded text-xs font-mono border transition-colors ${cashOutAt === v ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-white/5 hover:border-white/30"}`}
                  >
                    {v}×
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={running || api.loading} />
            </div>

            <div className="text-xs text-muted-foreground space-y-1 bg-white/5 p-3 rounded-lg">
              <p>Potential win: <span className="text-primary font-mono">{formatCurrency(bet * cashOutAt)}</span></p>
              <p>If crash ≥ {cashOutAt}× → win at exactly {cashOutAt}×</p>
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                className="w-full bg-red-500/90 hover:bg-red-400 text-white font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_35px_rgba(239,68,68,0.5)]"
                size="lg"
                disabled={running || api.loading}
                onClick={handlePlay}
              >
                {running ? "🚀 Flying…" : "🚀 Launch"}
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
