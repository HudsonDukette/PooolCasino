import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { usePlayRoulette, useGetPool, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { CasinoGameEditor } from "@/components/casino-game-editor";
import { Coins, AlertCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import rouletteImg from "@/assets/game-roulette.png";

type BetColor = "red" | "black" | "green";

function RouletteWheel({ spinning }: { spinning: boolean }) {
  return (
    <motion.div
      animate={spinning ? { rotate: 360 * 8 } : { rotate: 0 }}
      transition={spinning ? { duration: 2.2, ease: "circOut" } : { duration: 0 }}
      className="relative w-48 h-48 md:w-56 md:h-56"
    >
      <motion.div
        animate={spinning ? { boxShadow: ["0 0 20px rgba(0,255,136,0.3)", "0 0 60px rgba(0,255,136,0.7)", "0 0 20px rgba(0,255,136,0.3)"] } : {}}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="absolute inset-0 rounded-full"
      />
      <img
        src={rouletteImg}
        alt="Roulette Wheel"
        className="w-full h-full rounded-full object-cover"
        style={{ filter: spinning ? "drop-shadow(0 0 20px rgba(0,255,136,0.7))" : "drop-shadow(0 0 8px rgba(0,255,136,0.3))" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
      </div>
    </motion.div>
  );
}

const COLOR_CONFIG: Record<BetColor, { label: string; emoji: string; payout: string; chance: string; glow: string; activeClass: string; hoverClass: string }> = {
  red: {
    label: "Red",
    emoji: "🔴",
    payout: "2×",
    chance: "~47%",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]",
    activeClass: "bg-red-500 hover:bg-red-600 border-red-500",
    hoverClass: "hover:bg-red-500/10 hover:text-red-400 border-white/10",
  },
  black: {
    label: "Black",
    emoji: "⚫",
    payout: "2×",
    chance: "~47%",
    glow: "shadow-[0_0_20px_rgba(100,100,100,0.3)]",
    activeClass: "bg-gray-800 hover:bg-gray-700 text-white border-gray-600",
    hoverClass: "hover:bg-gray-800/50 hover:text-white border-white/10",
  },
  green: {
    label: "Green",
    emoji: "💚",
    payout: "50×",
    chance: "~2.5%",
    glow: "shadow-[0_0_20px_rgba(34,197,94,0.5)]",
    activeClass: "bg-green-600 hover:bg-green-500 border-green-500",
    hoverClass: "hover:bg-green-600/10 hover:text-green-400 border-white/10",
  },
};

export default function Roulette() {
  const { data: pool } = useGetPool();
  const { data: user } = useGetMe({ query: { retry: false } });
  const playMut = usePlayRoulette();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState<string>("10");
  const [color, setColor] = useState<BetColor>("red");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const numericBet = parseFloat(betAmount) || 0;

  // Clear watchdog on unmount
  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, []);

  const stopSpinning = () => {
    setSpinning(false);
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  };

  const handlePlay = () => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to play.", variant: "destructive" });
      return;
    }
    if (numericBet <= 0 || (pool && numericBet > pool.maxBet)) {
      toast({ title: "Invalid Bet", description: "Bet amount is outside allowed limits.", variant: "destructive" });
      return;
    }
    setSpinning(true);
    setResult(null);

    // Watchdog: if no response within 6s, unfreeze the UI
    watchdogRef.current = setTimeout(() => {
      stopSpinning();
      toast({ title: "Connection issue", description: "Request timed out. Please try again.", variant: "destructive" });
    }, 6000);

    playMut.mutate(
      { data: { betAmount: numericBet, color, ...(casinoId !== undefined ? { casinoId } : {}) } as any },
      {
        onSuccess: (data) => {
          if (watchdogRef.current) clearTimeout(watchdogRef.current);
          // Wait for wheel animation to finish before showing result
          setTimeout(() => {
            setResult(data);
            stopSpinning();
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/pool"] });

            if (data.won) {
              toast({
                title: color === "green" ? "💚 GREEN! Jackpot!" : "🎉 You Won!",
                description: `Payout: ${formatCurrency(data.payout)}`,
              });
            } else {
              toast({ title: "No luck this time", description: `Lost ${formatCurrency(numericBet)}`, variant: "destructive" });
            }
          }, 2300);
        },
        onError: (err) => {
          stopSpinning();
          toast({
            title: "Error",
            description: (err as any)?.error?.error || "Failed to place bet",
            variant: "destructive",
          });
        }
      }
    );
  };

  const cfg = COLOR_CONFIG[color];
  const resultGlowColor =
    result?.resultColor === "red" ? "rgba(239,68,68,0.6)" :
    result?.resultColor === "green" ? "rgba(34,197,94,0.7)" :
    "rgba(100,100,100,0.5)";

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link href={casinoId !== undefined ? `/casino/${casinoId}` : "/games"}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            {casinoId !== undefined ? "Back to Casino" : "All Games"}
          </Button>
        </Link>
      </div>
      <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-white/10">
        <img src={rouletteImg} alt="Neon Roulette" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-primary">Neon Roulette</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Classic red or black with dynamic odds based on the global pool.</p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-8">
        {/* Game Area */}
        <div className="flex-1 space-y-6">
          <Card className="bg-black/60 border-white/10 overflow-hidden relative min-h-[400px] flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,136,0.05),transparent_70%)]" />

            <AnimatePresence mode="wait">
              {!spinning && !result ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center z-10 flex flex-col items-center gap-6"
                >
                  <RouletteWheel spinning={false} />
                  <p className="text-muted-foreground text-lg">Place your bet to spin</p>
                </motion.div>
              ) : spinning ? (
                <motion.div
                  key="spinning"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="z-10 flex flex-col items-center gap-6"
                >
                  <RouletteWheel spinning={true} />
                  <motion.p
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-primary text-xl font-bold font-display"
                  >
                    Spinning…
                  </motion.p>
                </motion.div>
              ) : result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                  className="text-center z-10 flex flex-col items-center gap-4"
                >
                  <motion.div
                    animate={{ boxShadow: ["0 0 0px transparent", `0 0 50px ${resultGlowColor}`, "0 0 0px transparent"] }}
                    transition={{ duration: 1, repeat: 2 }}
                    className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl font-display font-black shadow-2xl ${
                      result.resultColor === "red" ? "bg-red-500 text-white" :
                      result.resultColor === "green" ? "bg-green-500 text-white" :
                      "bg-gray-900 border-2 border-white/20 text-white"
                    }`}
                  >
                    {result.resultNumber}
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold font-display uppercase tracking-widest text-white capitalize">
                      {result.resultColor} {result.resultNumber}
                    </h3>
                    {result.won ? (
                      <motion.p
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        className={`mt-2 text-2xl font-mono font-bold ${result.resultColor === "green" ? "text-green-400" : "text-primary"}`}
                      >
                        +{formatCurrency(result.payout)}
                        {result.resultColor === "green" && <span className="ml-2 text-base">💚 50×</span>}
                      </motion.p>
                    ) : (
                      <p className="mt-2 text-xl text-destructive font-mono opacity-80">
                        -{formatCurrency(result.betAmount)}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="mt-2 border-white/10" onClick={() => setResult(null)}>
                    Play Again
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Card>
        </div>

        {/* Controls Area */}
        <div className="w-full md:w-80 space-y-6">
          <Card className="border-white/10 bg-card/80">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Bet Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Coins className="w-5 h-5" />
                  </span>
                  <Input
                    type="number"
                    min="0.01"
                    step="1"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={spinning}
                    className="pl-10 font-mono text-lg h-14 bg-black/50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 border-white/10" onClick={() => setBetAmount((numericBet / 2).toString())} disabled={spinning}>1/2</Button>
                  <Button variant="outline" size="sm" className="flex-1 border-white/10" onClick={() => setBetAmount((numericBet * 2).toString())} disabled={spinning}>2×</Button>
                  {user && (
                    <Button variant="outline" size="sm" className="flex-1 border-white/10" onClick={() => setBetAmount(String(user.balance))} disabled={spinning}>Max</Button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Color</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["red", "black", "green"] as BetColor[]).map((c) => {
                    const conf = COLOR_CONFIG[c];
                    const isActive = color === c;
                    return (
                      <motion.div key={c} whileTap={{ scale: 0.95 }}>
                        <Button
                          variant={isActive ? "default" : "outline"}
                          onClick={() => setColor(c)}
                          disabled={spinning}
                          className={`w-full h-16 font-bold flex flex-col gap-0.5 text-xs ${isActive ? `${conf.activeClass} ${conf.glow}` : conf.hoverClass}`}
                        >
                          <span className="text-base">{conf.emoji}</span>
                          <span>{conf.label}</span>
                          <span className="opacity-70">{conf.payout}</span>
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
                {color === "green" && (
                  <p className="text-xs text-green-400/80 bg-green-950/30 border border-green-500/20 rounded-lg p-2 text-center">
                    💚 Rare bet — lands on 0 only. <strong>50× payout</strong> if you hit it!
                  </p>
                )}
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Win Chance
                  </span>
                  <span className="font-mono font-medium text-primary">{cfg.chance}</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-3">
                  <span className="text-muted-foreground">Potential payout</span>
                  <span className="font-mono font-medium text-primary">
                    {numericBet > 0 ? formatCurrency(numericBet * (color === "green" ? 50 : 2)) : "—"}
                  </span>
                </div>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    size="lg"
                    className={`w-full h-16 text-xl ${color === "green" ? "bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]" : "shadow-[0_0_20px_rgba(0,255,136,0.2)] hover:shadow-[0_0_30px_rgba(0,255,136,0.4)]"}`}
                    onClick={handlePlay}
                    disabled={spinning || numericBet <= 0}
                  >
                    {spinning ? "Spinning…" : `🎡 Bet on ${cfg.label}`}
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>

          {pool && (
            <div className="text-xs text-muted-foreground text-center bg-white/5 p-4 rounded-xl border border-white/5">
              Max Bet: <span className="text-white font-mono">{formatCurrency(pool.maxBet)}</span>
            </div>
          )}
        </div>
      </div>

      {casinoId && (
        <CasinoGameEditor casinoId={casinoId} gameType="roulette" />
      )}
    </div>
  );
}
