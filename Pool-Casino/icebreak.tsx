import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-icebreak.png";
import { formatCurrency, useCasinoId } from "@/lib/utils";
import { GAME_PAY_TABLES } from "@/lib/game-pay-tables";

const BASE = import.meta.env.BASE_URL;
const TOTAL_TILES = 16;

type GamePhase = "idle" | "playing" | "cashedOut" | "cracked";

interface TileState {
  revealed: boolean;
  isSafe: boolean;
  isDanger: boolean;
  isHit: boolean;
}

async function apiPost(path: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${BASE}api/games/${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiGet(path: string) {
  const res = await fetch(`${BASE}api/games/${path}`, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function blankTiles(): TileState[] {
  return Array.from({ length: TOTAL_TILES }, () => ({ revealed: false, isSafe: false, isDanger: false, isHit: false }));
}

export default function IceBreak() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState("100");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [loading, setLoading] = useState(false);
  const [tiles, setTiles] = useState<TileState[]>(blankTiles());
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [potentialPayout, setPotentialPayout] = useState(0);
  const [finalResult, setFinalResult] = useState<{ payout: number; multiplier: number } | null>(null);
  const [activeBet, setActiveBet] = useState(0);

  const bet = parseFloat(betAmount) || 0;
  const isPlaying = phase === "playing";

  useEffect(() => {
    apiGet("icebreak/status").then((data) => {
      if (!data.active) return;
      setActiveBet(data.betAmount);
      setBetAmount(String(data.betAmount));
      setRevealedCount(data.revealedSafe.length);
      setCurrentMultiplier(data.currentMultiplier);
      setPotentialPayout(data.potentialPayout);
      setTiles((prev) => {
        const next = [...prev];
        (data.revealedSafe as number[]).forEach((i) => {
          next[i] = { revealed: true, isSafe: true, isDanger: false, isHit: false };
        });
        return next;
      });
      setPhase("playing");
    }).catch(() => {});
  }, []);

  function resetGame() {
    setPhase("idle");
    setTiles(blankTiles());
    setRevealedCount(0);
    setCurrentMultiplier(1);
    setPotentialPayout(0);
    setFinalResult(null);
    qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    qc.invalidateQueries({ queryKey: ["/api/pool"] });
  }

  async function handleStart() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await apiPost("icebreak/start", { betAmount: bet, casinoId });
      setActiveBet(bet);
      setPhase("playing");
      setTiles(blankTiles());
      setRevealedCount(0);
      setCurrentMultiplier(1);
      setPotentialPayout(0);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to start", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleReveal(index: number) {
    if (!isPlaying || loading || tiles[index].revealed) return;
    setLoading(true);
    try {
      const data = await apiPost("icebreak/reveal", { tileIndex: index });
      if (data.hitDanger) {
        setTiles((prev) => {
          const next = [...prev];
          (data.dangerPositions as number[]).forEach((di: number) => {
            next[di] = { ...next[di], revealed: true, isDanger: true, isSafe: false, isHit: di === index };
          });
          return next;
        });
        setPhase("cracked");
        setFinalResult({ payout: 0, multiplier: 0 });
        toast({ title: "💥 Cracked Ice!", description: `Lost ${formatCurrency(activeBet)}`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      } else {
        setTiles((prev) => {
          const next = [...prev];
          next[index] = { revealed: true, isSafe: true, isDanger: false, isHit: false };
          return next;
        });
        setRevealedCount(data.revealedSafe.length);
        setCurrentMultiplier(data.currentMultiplier);
        setPotentialPayout(data.potentialPayout);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reveal", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCashout() {
    if (!isPlaying || loading || revealedCount === 0) return;
    setLoading(true);
    try {
      const data = await apiPost("icebreak/cashout", {});
      setTiles((prev) => {
        const next = [...prev];
        (data.dangerPositions as number[]).forEach((di: number) => {
          if (!next[di].revealed) next[di] = { revealed: true, isDanger: true, isSafe: false, isHit: false };
        });
        return next;
      });
      setPhase("cashedOut");
      setFinalResult({ payout: data.payout, multiplier: data.multiplier });
      toast({
        title: `❄️ Cashed out ${formatCurrency(data.payout)}!`,
        description: `${data.multiplier.toFixed(2)}× — ${revealedCount} safe tiles found`,
        className: "bg-success text-success-foreground border-none",
      });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to cash out", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleAbandon() {
    if (loading) return;
    setLoading(true);
    try {
      const data = await apiPost("icebreak/abandon", {});
      setTiles((prev) => {
        const next = [...prev];
        (data.dangerPositions as number[]).forEach((di: number) => {
          next[di] = { revealed: true, isDanger: true, isSafe: false, isHit: false };
        });
        return next;
      });
      setPhase("cracked");
      setFinalResult({ payout: 0, multiplier: 0 });
      toast({ title: "Game abandoned", description: `Lost ${formatCurrency(activeBet)}`, variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to abandon", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <GameShell casinoId={casinoId} gameType="icebreak" payTableEntries={GAME_PAY_TABLES.icebreak} heroImage={heroImg} title="Ice Break" description="A 4×4 grid hides 4 cracked tiles. Click to reveal safe ice — cash out before you crack through!" accentColor="text-cyan-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Tile Grid */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-4 gap-2.5">
              {tiles.map((tile, i) => (
                <motion.button key={i}
                  onClick={() => handleReveal(i)}
                  disabled={!isPlaying || loading || tile.revealed}
                  whileHover={isPlaying && !tile.revealed && !loading ? { scale: 1.07 } : {}}
                  whileTap={isPlaying && !tile.revealed && !loading ? { scale: 0.93 } : {}}
                  className={`
                    aspect-square rounded-xl border-2 text-2xl font-bold flex items-center justify-center
                    transition-all duration-200 select-none
                    ${tile.isHit
                      ? "bg-red-500/30 border-red-500/70 shadow-[0_0_16px_rgba(239,68,68,0.5)]"
                      : tile.isDanger
                      ? "bg-orange-950/40 border-orange-500/30"
                      : tile.isSafe
                      ? "bg-cyan-500/20 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                      : isPlaying && !loading
                      ? "bg-white/5 border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/40 cursor-pointer"
                      : "bg-white/5 border-white/10 cursor-not-allowed opacity-60"
                    }
                  `}>
                  <AnimatePresence mode="wait">
                    {tile.isHit ? (
                      <motion.span key="hit" initial={{ scale: 0 }} animate={{ scale: 1 }}>💥</motion.span>
                    ) : tile.isDanger ? (
                      <motion.span key="danger" initial={{ scale: 0 }} animate={{ scale: 1 }} className="opacity-70">🔥</motion.span>
                    ) : tile.isSafe ? (
                      <motion.span key="safe" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}>❄️</motion.span>
                    ) : (
                      <span key="empty" className="opacity-0">·</span>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))}
            </div>

            <AnimatePresence>
              {(phase === "cashedOut" || phase === "cracked") && finalResult && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl p-4 text-center border ${
                    phase === "cashedOut" ? "bg-cyan-950/40 border-cyan-500/30" : "bg-red-950/40 border-red-500/30"
                  }`}>
                  {phase === "cashedOut" ? (
                    <>
                      <p className="text-2xl font-display font-bold text-cyan-300">+{formatCurrency(finalResult.payout)}</p>
                      <p className="text-sm text-muted-foreground">{finalResult.multiplier.toFixed(2)}× · {revealedCount} safe tiles</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-display font-bold text-red-400">💥 Cracked Ice!</p>
                      <p className="text-sm text-muted-foreground">Lost {formatCurrency(activeBet)}</p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={isPlaying || loading} />
            </div>

            {/* Live stats while playing */}
            {isPlaying && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-black/40 rounded-xl p-4 space-y-2 border border-cyan-500/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bet placed</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(activeBet)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Safe tiles found</span>
                  <span className="font-mono font-bold text-cyan-400">{revealedCount} / 12</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Multiplier</span>
                  <span className="font-mono font-bold text-cyan-300">{currentMultiplier.toFixed(2)}×</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cash out now</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(potentialPayout)}</span>
                </div>
              </motion.div>
            )}

            {/* Idle info */}
            {phase === "idle" && (
              <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-xs text-muted-foreground space-y-1.5">
                <p className="text-cyan-400 font-semibold">How to Play</p>
                <p>4 tiles hide cracked ice beneath the surface. Click any tile to test it. Find a safe tile (❄️) and your multiplier grows. Hit a danger tile (💥) and you lose. Cash out any time!</p>
              </div>
            )}

            {/* Buttons */}
            {phase === "idle" && (
              <Button className="w-full bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                size="lg" disabled={loading || bet < 0.01} onClick={handleStart}>
                {loading ? "Starting…" : "❄️ Start Game"}
              </Button>
            )}

            {isPlaying && (
              <div className="space-y-2">
                <Button className="w-full bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  size="lg" disabled={loading || revealedCount === 0} onClick={handleCashout}>
                  {loading ? "Processing…" : revealedCount === 0 ? "Reveal a tile first" : `💰 Cash Out — ${formatCurrency(potentialPayout)}`}
                </Button>
                <Button variant="ghost" className="w-full text-red-400/70 hover:text-red-400 hover:bg-red-500/10 text-xs"
                  size="sm" disabled={loading} onClick={handleAbandon}>
                  Abandon game (forfeit bet)
                </Button>
                <p className="text-xs text-center text-muted-foreground">4 danger tiles hidden · click tiles to reveal</p>
              </div>
            )}

            {(phase === "cashedOut" || phase === "cracked") && (
              <Button className="w-full font-bold" size="lg" onClick={resetGame}>🔄 Play Again</Button>
            )}

          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
