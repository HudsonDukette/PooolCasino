import React, { useState, useRef } from "react";
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

const SEGMENTS = [
  { label: "0.2×", multiplier: 0.2, color: "#ef4444", bg: "rgba(239,68,68,0.2)"   },
  { label: "0.5×", multiplier: 0.5, color: "#f97316", bg: "rgba(249,115,22,0.2)"  },
  { label: "1×",   multiplier: 1,   color: "#eab308", bg: "rgba(234,179,8,0.2)"   },
  { label: "1.5×", multiplier: 1.5, color: "#22c55e", bg: "rgba(34,197,94,0.2)"   },
  { label: "2×",   multiplier: 2,   color: "#06b6d4", bg: "rgba(6,182,212,0.2)"   },
  { label: "3×",   multiplier: 3,   color: "#8b5cf6", bg: "rgba(139,92,246,0.2)"  },
  { label: "5×",   multiplier: 5,   color: "#ec4899", bg: "rgba(236,72,153,0.2)"  },
  { label: "10×",  multiplier: 10,  color: "#00ffaa", bg: "rgba(0,255,170,0.2)"   },
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length;

interface WheelResult {
  won: boolean;
  segment: string;
  segmentIndex: number;
  payout: number;
  multiplier: number;
  newBalance: number;
}

function WheelDisplay({ spinning, rotation }: { spinning: boolean; rotation: number }) {
  return (
    <div className="relative w-56 h-56">
      {/* Pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 text-2xl">▼</div>
      <motion.svg
        viewBox="0 0 200 200"
        className="w-full h-full"
        animate={{ rotate: rotation }}
        transition={spinning ? { duration: 3, ease: "easeOut" } : {}}
      >
        {SEGMENTS.map((seg, i) => {
          const startAngle = (i * SEGMENT_ANGLE - 90) * (Math.PI / 180);
          const endAngle = ((i + 1) * SEGMENT_ANGLE - 90) * (Math.PI / 180);
          const x1 = 100 + 90 * Math.cos(startAngle);
          const y1 = 100 + 90 * Math.sin(startAngle);
          const x2 = 100 + 90 * Math.cos(endAngle);
          const y2 = 100 + 90 * Math.sin(endAngle);
          const midAngle = ((i + 0.5) * SEGMENT_ANGLE - 90) * (Math.PI / 180);
          const tx = 100 + 65 * Math.cos(midAngle);
          const ty = 100 + 65 * Math.sin(midAngle);

          return (
            <g key={i}>
              <path
                d={`M 100 100 L ${x1} ${y1} A 90 90 0 0 1 ${x2} ${y2} Z`}
                fill={seg.bg}
                stroke={seg.color}
                strokeWidth="1.5"
              />
              <text
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={seg.color}
                fontSize="10"
                fontWeight="bold"
                fontFamily="monospace"
                transform={`rotate(${(i + 0.5) * SEGMENT_ANGLE}, ${tx}, ${ty})`}
              >
                {seg.label}
              </text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="10" fill="#0a0a0a" stroke="white" strokeWidth="1.5" />
      </motion.svg>
    </div>
  );
}

export default function Wheel() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<WheelResult>();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState("10");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<WheelResult | null>(null);
  const totalRotation = useRef(0);

  const bet = parseFloat(betAmount) || 0;

  async function handleSpin() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }

    setSpinning(true);
    setResult(null);

    const data = await api.call("wheel", { betAmount: bet, casinoId });
    if (!data) {
      setSpinning(false);
      toast({ title: "Bet failed", description: api.error ?? "Something went wrong", variant: "destructive" });
      return;
    }

    // Spin to land on the winning segment
    // targetEffective = how far the wheel needs to be rotated so segment i aligns with the top marker
    const segIdx = data.segmentIndex;
    const targetAngle = (segIdx + 0.5) * SEGMENT_ANGLE;
    const targetEffective = (360 - targetAngle + 360) % 360;
    // Compute delta from current position so cumulative rotation stays consistent
    const currentEffective = totalRotation.current % 360;
    const additionalOffset = (targetEffective - currentEffective + 360) % 360;
    totalRotation.current += 5 * 360 + additionalOffset;

    setRotation(totalRotation.current);

    setTimeout(() => {
      setSpinning(false);
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      toast({
        title: data.multiplier >= 1 ? `${data.segment} — ${data.won ? "Win!" : "Push"}` : `${data.segment}`,
        description: data.won ? `Won ${formatCurrency(data.payout)}!` : `Got back ${formatCurrency(data.payout)}`,
        variant: data.multiplier >= 1 ? "default" : "destructive",
      });
    }, 3100);
  }

  return (
    <GameShell casinoId={casinoId} gameType="wheel" payTableEntries={GAME_PAY_TABLES.wheel} title="Fortune Wheel" description="Spin the wheel. Higher multipliers are rarer." accentColor="text-purple-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wheel */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-8 flex flex-col items-center gap-6 min-h-[360px] justify-center">
            <WheelDisplay spinning={spinning} rotation={rotation} />
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center"
                >
                  <p className={`text-3xl font-display font-bold ${result.multiplier > 1 ? "text-primary" : result.multiplier === 1 ? "text-yellow-400" : "text-destructive"}`}>
                    {result.segment}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {result.payout > 0 ? `Payout: ${formatCurrency(result.payout)}` : "No payout"}
                    {" · "}Balance: {formatCurrency(result.newBalance)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Controls + Odds */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={spinning || api.loading} />
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Wheel Segments</p>
              <div className="space-y-1.5">
                {SEGMENTS.map(s => (
                  <div key={s.label} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="font-mono" style={{ color: s.color }}>{s.label}</span>
                    <span className="text-muted-foreground text-xs ml-auto">
                      {s.multiplier >= 5 ? "rare" : s.multiplier >= 2 ? "uncommon" : "common"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <Button
              className="w-full bg-purple-600/90 hover:bg-purple-500 text-white font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)]"
              size="lg"
              disabled={spinning || api.loading}
              onClick={handleSpin}
            >
              {spinning ? "Spinning…" : "🎡 Spin"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
