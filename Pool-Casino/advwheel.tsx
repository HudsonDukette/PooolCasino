import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-advwheel.png";
import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

const SEGMENTS = [
  { label: "0×",   multiplier: 0,   fill: "#1a1a2e", border: "#444",    text: "#666",    glow: null },
  { label: "0.3×", multiplier: 0.3, fill: "#1e1030", border: "#7c3aed", text: "#a78bfa", glow: null },
  { label: "1.5×", multiplier: 1.5, fill: "#0a2520", border: "#065f46", text: "#34d399", glow: null },
  { label: "2×",   multiplier: 2,   fill: "#0f2010", border: "#166534", text: "#4ade80", glow: "#4ade80" },
  { label: "3×",   multiplier: 3,   fill: "#081830", border: "#164e63", text: "#38bdf8", glow: "#38bdf8" },
  { label: "5×",   multiplier: 5,   fill: "#0d0d3a", border: "#312e81", text: "#818cf8", glow: "#818cf8" },
  { label: "10×",  multiplier: 10,  fill: "#1a083a", border: "#4c1d95", text: "#c084fc", glow: "#c084fc" },
  { label: "25×",  multiplier: 25,  fill: "#2d0820", border: "#831843", text: "#f472b6", glow: "#f472b6" },
  { label: "50×",  multiplier: 50,  fill: "#3a0505", border: "#7f1d1d", text: "#f87171", glow: "#f87171" },
];

const SEG_COUNT = SEGMENTS.length;
const SEG_ANGLE = 360 / SEG_COUNT;
const CX = 100, CY = 100, R = 88;

function segPath(i: number) {
  const a1 = ((i * SEG_ANGLE) - 90) * (Math.PI / 180);
  const a2 = ((i * SEG_ANGLE + SEG_ANGLE) - 90) * (Math.PI / 180);
  const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
  const x2 = CX + R * Math.cos(a2), y2 = CY + R * Math.sin(a2);
  return `M${CX},${CY} L${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} Z`;
}

function labelPos(i: number) {
  const mid = ((i * SEG_ANGLE + SEG_ANGLE / 2) - 90) * (Math.PI / 180);
  return { x: CX + (R * 0.62) * Math.cos(mid), y: CY + (R * 0.62) * Math.sin(mid) };
}

export default function AdvWheel() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [landedIdx, setLandedIdx] = useState<number | null>(null);
  const rotRef = useRef(0);

  async function handleSpin() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    setSpinning(true);
    setResult(null);
    setLandedIdx(null);
    try {
      const res = await fetch(`${BASE}api/games/advwheel`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      // Compute final rotation so the landed segment's midpoint aligns with the top marker
      const currentVisual = rotRef.current % 360;
      const targetVisual = (360 - data.segmentIndex * SEG_ANGLE - SEG_ANGLE / 2 + 360) % 360;
      const delta = (targetVisual - currentVisual + 360) % 360;
      const spinExtra = 360 * (6 + Math.floor(Math.random() * 3));
      const finalRot = rotRef.current + spinExtra + delta;
      rotRef.current = finalRot;
      setRotation(finalRot);

      setTimeout(() => {
        setSpinning(false);
        setLandedIdx(data.segmentIndex);
        setResult(data);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        if (data.won) {
          toast({ title: `🎡 ${data.segment}! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
        } else {
          toast({ title: `Landed on ${data.segment}. ${data.payout > 0 ? `Got ${formatCurrency(data.payout)} back.` : "No win."}`, variant: data.payout > 0 ? "default" : "destructive" });
        }
      }, 3200);
    } catch (err: unknown) {
      setSpinning(false);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const landedSeg = landedIdx !== null ? SEGMENTS[landedIdx] : null;

  return (
    <GameShell heroImage={heroImg} title="Advanced Wheel" description="9 segments with payouts up to 50×. Higher-risk spin, bigger potential jackpots." accentColor="text-purple-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={loading || spinning} />
            </div>

            {/* Segment reference */}
            <div className="grid grid-cols-3 gap-1.5 text-xs text-center">
              {SEGMENTS.map((s, i) => (
                <div key={i}
                  className={`rounded-lg px-2 py-1.5 border transition-all ${landedIdx === i ? "scale-105 border-opacity-100" : "border-white/5 opacity-70"}`}
                  style={{ background: s.fill + "cc", borderColor: landedIdx === i ? s.border : undefined, boxShadow: landedIdx === i && s.glow ? `0 0 12px ${s.glow}60` : undefined }}>
                  <span style={{ color: s.text }} className="font-mono font-bold">{s.label}</span>
                </div>
              ))}
            </div>

            <Button className="w-full font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)]"
              style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)" }}
              size="lg" disabled={loading || spinning} onClick={handleSpin}>
              {spinning ? "Spinning…" : "🎡 Spin"}
            </Button>

            <AnimatePresence>
              {result && !spinning && landedSeg && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center px-4 py-4 rounded-xl border"
                  style={{ background: landedSeg.fill + "cc", borderColor: landedSeg.border, boxShadow: landedSeg.glow ? `0 0 20px ${landedSeg.glow}40` : undefined }}>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Landed On</p>
                  <p className="font-display font-bold text-3xl" style={{ color: landedSeg.text }}>{landedSeg.label}</p>
                  {result.won ? (
                    <p className="text-sm font-bold text-green-400 mt-1">+{formatCurrency(result.payout)}</p>
                  ) : result.payout > 0 ? (
                    <p className="text-sm text-muted-foreground mt-1">{formatCurrency(result.payout)} returned</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">No win</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Wheel */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-4">
            <div className="relative w-60 h-60">
              {/* Pointer triangle at top */}
              <div className="absolute top-0 left-1/2 z-20 pointer-events-none"
                style={{ transform: "translateX(-50%) translateY(-4px)" }}>
                <div className="w-0 h-0" style={{ borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "22px solid white", filter: "drop-shadow(0 0 4px rgba(255,255,255,0.6))" }} />
              </div>

              {/* Rotating wheel SVG */}
              <motion.svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl"
                animate={{ rotate: rotation }}
                transition={{ duration: 3.2, ease: [0.05, 0.85, 0.3, 1] }}>
                {SEGMENTS.map((seg, i) => {
                  const isLanded = !spinning && landedIdx === i;
                  const lp = labelPos(i);
                  return (
                    <g key={i}>
                      <path d={segPath(i)} fill={isLanded ? seg.fill + "ff" : seg.fill + "dd"} stroke={seg.border}
                        strokeWidth={isLanded ? 2.5 : 1} />
                      {isLanded && seg.glow && (
                        <path d={segPath(i)} fill="none" stroke={seg.glow} strokeWidth={3} opacity={0.5} />
                      )}
                      <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
                        fill={seg.text} fontSize={i >= 6 ? 8.5 : 9} fontWeight="bold" fontFamily="monospace"
                        transform={`rotate(${i * SEG_ANGLE + SEG_ANGLE / 2}, ${lp.x}, ${lp.y})`}>
                        {seg.label}
                      </text>
                    </g>
                  );
                })}
                {/* Center cap */}
                <circle cx="100" cy="100" r="11" fill="#080810" stroke="#333" strokeWidth="2" />
                <circle cx="100" cy="100" r="5" fill="#222" />
              </motion.svg>
            </div>

            {/* Landing indicator below wheel */}
            <AnimatePresence>
              {!spinning && landedSeg && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="text-center text-sm font-bold px-4 py-2 rounded-xl border"
                  style={{ color: landedSeg.text, borderColor: landedSeg.border, background: landedSeg.fill + "cc" }}>
                  ▲ Marker landed on {landedSeg.label}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
