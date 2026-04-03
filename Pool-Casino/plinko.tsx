import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { usePlayPlinko, useGetPool, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { CasinoGameEditor } from "@/components/casino-game-editor";
import { Coins, Info, StopCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import plinkoImg from "@/assets/game-plinko.png";

const RISK_LEVELS = {
  low:    { name: "Low",    color: "bg-blue-500",    textColor: "text-blue-400",   mults: [0.5, 1, 1.5, 2, 2.5, 2, 1.5, 1, 0.5] },
  medium: { name: "Medium", color: "bg-yellow-500",  textColor: "text-yellow-400", mults: [0.3, 0.5, 1, 2, 5, 2, 1, 0.5, 0.3] },
  high:   { name: "High",   color: "bg-destructive", textColor: "text-red-400",    mults: [0.1, 0.2, 0.5, 1, 10, 1, 0.5, 0.2, 0.1] }
};

interface BallState {
  id: number;
  coords: { x: number; y: number }[];
  multiplier: number;
  slot: number;
  won: boolean;
  animDuration: number;
}

const ROWS = 8;
const ROW_HEIGHT = 44;
const PEG_SPACING = 42;
const DEFAULT_BALL_SPAWN_DELAY = 400;

export default function Plinko() {
  const { data: pool } = useGetPool();
  const { data: user } = useGetMe({ query: { retry: false } });
  const playMut = usePlayPlinko();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState<string>("10");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [balls, setBalls] = useState<BallState[]>([]);
  // Map<slotIndex, refCount> so multiple balls can light up slots simultaneously
  const [highlightedSlots, setHighlightedSlots] = useState<Map<number, number>>(new Map());
  const [inFlightTotal, setInFlightTotal] = useState(0);
  const nextBallId = useRef(0);
  const MAX_BALLS = 100;
  const ballsCountRef = useRef(0);

  // Multi-ball state
  const [ballCount, setBallCount] = useState<string>("1");
  const [dropDelay, setDropDelay] = useState(DEFAULT_BALL_SPAWN_DELAY);
  const [isDropping, setIsDropping] = useState(false);
  const droppingRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Keep ballsCountRef always current so closures can read live count
  useEffect(() => { ballsCountRef.current = balls.length; }, [balls]);

  const numericBet = parseFloat(betAmount) || 0;
  const numericCount = Math.max(1, Math.min(100, parseInt(ballCount) || 1));
  const displayBalance = user ? Math.max(0, user.balance - inFlightTotal) : 0;
  const totalCost = numericBet * numericCount;

  const stopDropping = useCallback(() => {
    droppingRef.current = false;
    setIsDropping(false);
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
  }, []);

  useEffect(() => () => stopDropping(), [stopDropping]);

  const dropOneBall = useCallback((betAmt: number, riskLevel: "low" | "medium" | "high") => {
    setInFlightTotal(prev => prev + betAmt);

    playMut.mutate(
      { data: { betAmount: betAmt, risk: riskLevel, ...(casinoId !== undefined ? { casinoId } : {}) } as any },
      {
        onSuccess: (data) => {
          const coords = data.path as { x: number; y: number }[];
          const ballId = nextBallId.current++;
          const animDuration = Math.max(1.5, coords.length * 0.055);

          setBalls(prev => [...prev, { id: ballId, coords, multiplier: data.multiplier, slot: data.slot, won: data.won, animDuration }]);

          const highlightDelay = animDuration * 1000 + 100;
          const t1 = setTimeout(() => {
            const finalX = coords[coords.length - 1]?.x ?? 0;
            const visualSlot = Math.max(0, Math.min(ROWS, Math.round(finalX / PEG_SPACING + ROWS / 2)));
            const visualMultiplier = RISK_LEVELS[riskLevel].mults[visualSlot] ?? 0;

            setInFlightTotal(prev => Math.max(0, prev - betAmt));
            // Add this slot to the multi-highlight map (ref-counted)
            setHighlightedSlots(prev => {
              const next = new Map(prev);
              next.set(visualSlot, (next.get(visualSlot) ?? 0) + 1);
              return next;
            });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/pool"] });

            const isBreakEven = visualMultiplier === 1;
            if (data.won) {
              toast({
                title: `${visualMultiplier}x Win! 🎉`,
                description: `+${formatCurrency(data.payout)} returned to your balance`,
                className: "bg-success text-success-foreground border-none",
              });
            } else if (isBreakEven) {
              toast({ title: `1x — Break Even`, description: `Your ${formatCurrency(betAmt)} bet was returned` });
            } else {
              const netLoss = betAmt - data.payout;
              const gotBack = data.payout > 0 ? ` (got ${formatCurrency(data.payout)} back)` : "";
              toast({ title: `${visualMultiplier}x — No luck`, description: `Lost ${formatCurrency(netLoss)}${gotBack}`, variant: "destructive" });
            }

            // Decrement the ref count for this slot after highlight expires
            setTimeout(() => {
              setHighlightedSlots(prev => {
                const next = new Map(prev);
                const count = (next.get(visualSlot) ?? 1) - 1;
                if (count <= 0) next.delete(visualSlot);
                else next.set(visualSlot, count);
                return next;
              });
            }, 1200);
          }, highlightDelay);

          const t2 = setTimeout(() => {
            setBalls(prev => prev.filter(b => b.id !== ballId));
          }, highlightDelay + 800);

          timeoutsRef.current.push(t1, t2);
        },
        onError: (err) => {
          setInFlightTotal(prev => Math.max(0, prev - betAmt));
          toast({ title: "Error", description: (err as any).error?.error || "Failed to place bet", variant: "destructive" });
        },
      }
    );
  }, [playMut, queryClient, toast]);

  const handleDrop = useCallback(() => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to play.", variant: "destructive" });
      return;
    }
    if (numericBet <= 0) {
      toast({ title: "Invalid Bet", description: "Enter a valid bet amount.", variant: "destructive" });
      return;
    }
    if (numericCount === 1) {
      if (balls.length >= MAX_BALLS) {
        toast({ title: "Max balls reached", description: "Wait for some balls to finish.", variant: "destructive" });
        return;
      }
      dropOneBall(numericBet, risk);
    } else {
      droppingRef.current = true;
      setIsDropping(true);

      for (let i = 0; i < numericCount; i++) {
        const t = setTimeout(() => {
          if (!droppingRef.current) return;
          if (ballsCountRef.current >= MAX_BALLS) { stopDropping(); return; }
          dropOneBall(numericBet, risk);
          if (i === numericCount - 1) {
            droppingRef.current = false;
            setIsDropping(false);
          }
        }, i * dropDelay);
        timeoutsRef.current.push(t);
      }
    }
  }, [user, numericBet, numericCount, risk, dropDelay, displayBalance, totalCost, dropOneBall, stopDropping, toast]);

  // Render pegs
  const pegs: React.ReactNode[] = [];
  for (let r = 1; r <= ROWS; r++) {
    const pegsInRow = r + 1;
    const startX = -((pegsInRow - 1) * PEG_SPACING) / 2;
    for (let p = 0; p < pegsInRow; p++) {
      pegs.push(
        <div key={`peg-${r}-${p}`}
          className="absolute w-2.5 h-2.5 rounded-full bg-white/30 shadow-[0_0_6px_rgba(255,255,255,0.25)]"
          style={{ top: `${r * ROW_HEIGHT}px`, left: `calc(50% + ${startX + p * PEG_SPACING}px)`, transform: "translate(-50%, -50%)" }}
        />
      );
    }
  }

  const mults = RISK_LEVELS[risk].mults;
  const boardHeight = ROWS * ROW_HEIGHT + ROW_HEIGHT * 1.8;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link href={casinoId !== undefined ? `/casino/${casinoId}` : "/games"}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            {casinoId !== undefined ? "Back to Casino" : "All Games"}
          </Button>
        </Link>
      </div>
      <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-white/10">
        <img src={plinkoImg} alt="Drop Plinko" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-secondary">Drop Plinko</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Drop the ball through the pegs. Control your risk for massive multipliers.</p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-8">

        {/* Game Board */}
        <div className="flex-1 flex flex-col">
          <Card className="bg-black border-white/10 overflow-hidden relative flex-1 flex flex-col shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,0,255,0.06),transparent_70%)]" />
            <div className="relative w-full max-w-md mx-auto" style={{ height: `${boardHeight}px` }}>
              {pegs}
              <AnimatePresence>
                {balls.map((ball) => (
                  <motion.div key={ball.id}
                    className="absolute w-4 h-4 rounded-full z-20 pointer-events-none"
                    style={{
                      left: "50%", top: 0, marginLeft: -8, marginTop: -8,
                      background: ball.won ? "radial-gradient(circle, #fbbf24, #f59e0b)" : "radial-gradient(circle, #e879f9, #a21caf)",
                      boxShadow: ball.won ? "0 0 14px 3px rgba(251,191,36,0.8)" : "0 0 14px 3px rgba(232,121,249,0.8)",
                    }}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: ball.coords.map(c => c.x), y: ball.coords.map(c => c.y) }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{
                      duration: ball.animDuration, ease: "linear",
                      times: ball.coords.map((_, i) => i / Math.max(1, ball.coords.length - 1)),
                    }}
                  />
                ))}
              </AnimatePresence>
              <div className="absolute w-full flex justify-center gap-1 px-3" style={{ top: `${ROWS * ROW_HEIGHT + ROW_HEIGHT * 0.4}px` }}>
                {mults.map((m, i) => {
                  const isHighlighted = highlightedSlots.has(i);
                  return (
                    <motion.div key={i}
                      animate={isHighlighted ? { scale: 1.15 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                      className={`flex-1 flex items-center justify-center rounded-md py-2 text-xs font-mono font-bold transition-colors duration-200 ${
                        isHighlighted
                          ? `${RISK_LEVELS[risk].color} text-white shadow-[0_0_18px_currentColor]`
                          : "bg-white/5 text-muted-foreground border border-white/10"
                      }`}
                    >
                      {m}x
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Controls */}
        <div className="w-full md:w-80 space-y-6">
          <Card className="border-white/10 bg-card/80">
            <CardContent className="p-6 space-y-6">

              {/* Bet Amount */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Bet Amount</label>
                <div className="relative">
                  <Input type="number" min="0.01" step="1" value={betAmount}
                    onChange={e => setBetAmount(e.target.value)}
                    className="pl-10 font-mono text-lg h-14 bg-black/50 focus-visible:ring-secondary focus-visible:border-secondary"
                    icon={<Coins className="w-5 h-5" />}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount(String(Math.max(0.01, numericBet / 2)))}>½</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount(String(numericBet * 2))}>2×</Button>
                  {user && <Button variant="outline" size="sm" className="flex-1" onClick={() => setBetAmount(String(displayBalance))}>Max</Button>}
                </div>
              </div>

              {/* Risk Level */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground flex justify-between">
                  Risk Level
                  <span className="text-xs text-secondary/70 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Alters payouts
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["low", "medium", "high"] as const).map(r => (
                    <Button key={r} variant={risk === r ? "default" : "outline"} onClick={() => setRisk(r)}
                      className={`capitalize ${risk === r ? "bg-secondary hover:bg-secondary/90 shadow-secondary/20" : "hover:text-secondary hover:border-secondary/50"}`}>
                      {r}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Ball Count */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Balls to Drop</label>
                <div className="flex gap-2">
                  {[1, 3, 5, 10].map(n => (
                    <Button key={n} variant={numericCount === n && !isDropping ? "default" : "outline"}
                      size="sm" className="flex-1" disabled={isDropping}
                      onClick={() => setBallCount(String(n))}>
                      {n}
                    </Button>
                  ))}
                </div>
                <div className="relative">
                  <Input type="number" min="1" max="100" value={ballCount}
                    onChange={e => setBallCount(e.target.value)}
                    disabled={isDropping}
                    className="font-mono text-center bg-black/50 h-10"
                    placeholder="Custom..."
                  />
                </div>
                {numericCount > 1 && (
                  <div className="flex justify-between text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                    <span>Total cost</span>
                    <span className="font-mono font-bold text-secondary">{formatCurrency(totalCost)}</span>
                  </div>
                )}
              </div>

              {/* Drop Delay */}
              {numericCount > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex justify-between">
                    Drop Delay
                    <span className="font-mono text-secondary/80 text-xs">{(dropDelay / 1000).toFixed(2)}s</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-sm font-bold transition-all shrink-0"
                      onClick={() => setDropDelay(v => Math.max(150, v - 50))}
                      disabled={isDropping}
                    >−</button>
                    <input
                      type="range"
                      min={150}
                      max={2000}
                      step={50}
                      value={dropDelay}
                      disabled={isDropping}
                      onChange={e => setDropDelay(parseInt(e.target.value))}
                      className="flex-1 accent-secondary cursor-pointer"
                    />
                    <button
                      className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-sm font-bold transition-all shrink-0"
                      onClick={() => setDropDelay(v => Math.min(2000, v + 50))}
                      disabled={isDropping}
                    >+</button>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground/50 px-1">
                    <span>0.15s (fast)</span>
                    <span>2.00s (slow)</span>
                  </div>
                </div>
              )}

              {/* Stats */}
              {pool && (
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Win chance at ${numericBet || 0}</span>
                    <span className="text-white font-mono font-medium">
                      {pool.totalAmount
                        ? (() => {
                            const scale = Math.min(pool.totalAmount * 0.001, 5000);
                            const chance = Math.max(0.01, 0.45 / (1 + numericBet / scale));
                            return `${(chance * 100).toFixed(1)}%`;
                          })()
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Balls in flight</span>
                    <span className={`font-mono font-medium ${balls.length > 0 ? "text-secondary" : "text-white"}`}>
                      {balls.length}
                    </span>
                  </div>
                </div>
              )}

              {/* Drop Button */}
              {isDropping ? (
                <Button size="lg" variant="destructive"
                  className="w-full h-16 text-xl gap-3"
                  onClick={stopDropping}>
                  <StopCircle className="w-6 h-6" /> Stop Dropping
                </Button>
              ) : (
                <Button size="lg"
                  className="w-full h-16 text-xl bg-secondary hover:bg-secondary/90 shadow-secondary/20"
                  onClick={handleDrop}
                  disabled={numericBet <= 0 || !user}>
                  {numericCount === 1 ? "Drop Ball" : `Drop ${numericCount} Balls`}
                </Button>
              )}

            </CardContent>
          </Card>
        </div>
      </div>

      {casinoId && (
        <CasinoGameEditor casinoId={casinoId} gameType="plinko" />
      )}
    </div>
  );
}
