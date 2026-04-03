import React, { useState, useEffect } from "react";
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
const TOTAL_TILES = 25;

type GamePhase = "idle" | "playing" | "cashedOut" | "exploded";

interface TileState {
  revealed: boolean;
  isMine: boolean;
  isGem: boolean;
  isExplosion: boolean;
}

async function apiPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}api/games/${path}`, {
    method: "POST",
    credentials: "include",
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

function MineCountSelector({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled: boolean }) {
  const options = [1, 3, 5, 10, 15, 20, 24];
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground font-medium">Mines Count</p>
      <div className="flex flex-wrap gap-2">
        {options.map((n) => (
          <button
            key={n}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
              value === n
                ? "bg-orange-500/30 border-orange-500/70 text-orange-300"
                : "bg-black/30 border-white/10 text-muted-foreground hover:border-white/30"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            💣 {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{TOTAL_TILES - value} safe tiles · more mines = bigger multipliers</p>
    </div>
  );
}

function TileButton({
  index,
  state,
  onClick,
  disabled,
}: {
  index: number;
  state: TileState;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || state.revealed}
      whileHover={!disabled && !state.revealed ? { scale: 1.06 } : {}}
      whileTap={!disabled && !state.revealed ? { scale: 0.95 } : {}}
      className={`
        aspect-square rounded-xl border text-xl font-bold transition-all duration-200
        flex items-center justify-center select-none
        ${state.isExplosion
          ? "bg-red-500/30 border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
          : state.isGem
          ? "bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
          : state.isMine && state.revealed
          ? "bg-orange-950/40 border-orange-500/30"
          : !state.revealed && !disabled
          ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-orange-500/40 cursor-pointer"
          : "bg-white/5 border-white/10 cursor-not-allowed"
        }
      `}
    >
      <AnimatePresence mode="wait">
        {state.isExplosion ? (
          <motion.span key="exp" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-2xl">💥</motion.span>
        ) : state.isGem ? (
          <motion.span key="gem" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} className="text-xl">💎</motion.span>
        ) : state.isMine && state.revealed ? (
          <motion.span key="mine" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg opacity-60">💣</motion.span>
        ) : (
          <span key="hidden" className="opacity-0">·</span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default function Mines() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState("100");
  const [minesCount, setMinesCount] = useState(5);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [loading, setLoading] = useState(false);
  const [tiles, setTiles] = useState<TileState[]>(
    Array.from({ length: TOTAL_TILES }, () => ({ revealed: false, isMine: false, isGem: false, isExplosion: false }))
  );
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [potentialPayout, setPotentialPayout] = useState(0);
  const [finalResult, setFinalResult] = useState<{ payout: number; multiplier: number; won: boolean } | null>(null);
  const [activeMinesCount, setActiveMinesCount] = useState(5);

  const bet = parseFloat(betAmount) || 0;
  const isPlaying = phase === "playing";

  // On mount: check if the server already has an active game for this user
  // (happens when they navigated away mid-game without cashing out or hitting a mine)
  useEffect(() => {
    apiGet("mines/status").then((data) => {
      if (!data.active) return;
      // Restore the in-progress game
      setActiveMinesCount(data.minesCount);
      setBetAmount(String(data.betAmount));
      setRevealedCount(data.revealedSafe.length);
      setCurrentMultiplier(data.currentMultiplier);
      setPotentialPayout(data.potentialPayout);
      setTiles((prev) => {
        const next = [...prev];
        (data.revealedSafe as number[]).forEach((i) => {
          next[i] = { revealed: true, isGem: true, isMine: false, isExplosion: false };
        });
        return next;
      });
      setPhase("playing");
    }).catch(() => { /* not logged in or server error — ignore */ });
  }, []);

  async function handleAbandon() {
    if (loading) return;
    setLoading(true);
    try {
      const data = await apiPost("mines/abandon", {});
      // Show all mine positions
      setTiles((prev) => {
        const next = [...prev];
        (data.minePositions as number[]).forEach((mi) => {
          next[mi] = { revealed: true, isMine: true, isGem: false, isExplosion: false };
        });
        return next;
      });
      setPhase("exploded");
      setFinalResult({ payout: 0, multiplier: 0, won: false });
      toast({ title: "Game abandoned", description: `Lost ${formatCurrency(data.lostAmount)}. The bet was already deducted.`, variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to abandon", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function resetGame() {
    setPhase("idle");
    setTiles(Array.from({ length: TOTAL_TILES }, () => ({ revealed: false, isMine: false, isGem: false, isExplosion: false })));
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
    if (bet > parseFloat(String(user.balance))) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    setLoading(true);
    try {
      await apiPost("mines/start", { betAmount: bet, minesCount, casinoId });
      setActiveMinesCount(minesCount);
      setPhase("playing");
      setRevealedCount(0);
      setCurrentMultiplier(1);
      setPotentialPayout(0);
      setTiles(Array.from({ length: TOTAL_TILES }, () => ({ revealed: false, isMine: false, isGem: false, isExplosion: false })));
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to start", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleReveal(index: number) {
    if (!isPlaying || loading) return;
    setLoading(true);
    try {
      const data = await apiPost("mines/reveal", { tileIndex: index });

      if (data.hitMine) {
        // Show all mines
        setTiles((prev) => {
          const next = [...prev];
          data.minePositions.forEach((mi: number) => {
            next[mi] = { ...next[mi], revealed: true, isMine: true, isExplosion: mi === index, isGem: false };
          });
          return next;
        });
        setPhase("exploded");
        setFinalResult({ payout: 0, multiplier: 0, won: false });
        toast({ title: "💥 BOOM!", description: `Lost ${formatCurrency(bet)}. Better luck next time!`, variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      } else {
        setTiles((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], revealed: true, isGem: true, isMine: false, isExplosion: false };
          return next;
        });
        setRevealedCount(data.revealedSafe.length);
        setCurrentMultiplier(data.currentMultiplier);
        setPotentialPayout(data.potentialPayout);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reveal", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCashout() {
    if (!isPlaying || loading || revealedCount === 0) return;
    setLoading(true);
    try {
      const data = await apiPost("mines/cashout", {});
      setTiles((prev) => {
        const next = [...prev];
        data.minePositions.forEach((mi: number) => {
          if (!next[mi].revealed) {
            next[mi] = { ...next[mi], revealed: true, isMine: true, isExplosion: false, isGem: false };
          }
        });
        return next;
      });
      setPhase("cashedOut");
      setFinalResult({ payout: data.payout, multiplier: data.multiplier, won: data.won });
      toast({
        title: data.won ? `🎉 Cashed out ${formatCurrency(data.payout)}!` : `Cashed out ${formatCurrency(data.payout)}`,
        description: `${data.multiplier.toFixed(2)}× multiplier`,
        className: data.won ? "bg-success text-success-foreground border-none" : "",
      });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to cash out", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <GameShell casinoId={casinoId} gameType="mines" payTableEntries={GAME_PAY_TABLES.mines} title="Mines" description="Reveal safe tiles to grow your multiplier. Hit a mine and lose everything." accentColor="text-orange-400">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Grid */}
        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 space-y-4">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
            >
              {tiles.map((tile, i) => (
                <TileButton
                  key={i}
                  index={i}
                  state={tile}
                  onClick={() => handleReveal(i)}
                  disabled={!isPlaying || loading}
                />
              ))}
            </div>

            {/* Result overlay */}
            <AnimatePresence>
              {(phase === "cashedOut" || phase === "exploded") && finalResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl p-4 text-center border ${
                    phase === "cashedOut"
                      ? "bg-emerald-950/40 border-emerald-500/30"
                      : "bg-red-950/40 border-red-500/30"
                  }`}
                >
                  {phase === "cashedOut" ? (
                    <>
                      <p className="text-2xl font-display font-bold text-emerald-300">
                        +{formatCurrency(finalResult.payout)}
                      </p>
                      <p className="text-sm text-muted-foreground">{finalResult.multiplier.toFixed(2)}× · {revealedCount} gems found</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-display font-bold text-red-400">💥 Mine Hit!</p>
                      <p className="text-sm text-muted-foreground">Lost {formatCurrency(bet)}</p>
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
            {/* Bet + mines (only editable before game starts) */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={isPlaying || loading} />
            </div>

            <MineCountSelector value={isPlaying ? activeMinesCount : minesCount} onChange={setMinesCount} disabled={isPlaying || loading} />

            {/* Live stats during game */}
            {isPlaying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-black/40 rounded-xl p-4 space-y-2 border border-orange-500/20"
              >
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gems revealed</span>
                  <span className="font-mono font-bold text-emerald-400">{revealedCount} / {TOTAL_TILES - activeMinesCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current multiplier</span>
                  <span className="font-mono font-bold text-orange-300">{currentMultiplier.toFixed(2)}×</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">If you cash out now</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(potentialPayout)}</span>
                </div>
              </motion.div>
            )}

            {/* Action buttons */}
            {phase === "idle" && (
              <Button
                className="w-full bg-orange-600/90 hover:bg-orange-500 text-white font-bold shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                size="lg"
                disabled={loading || bet < 0.01}
                onClick={handleStart}
              >
                {loading ? "Starting…" : "💣 Start Game"}
              </Button>
            )}

            {isPlaying && (
              <div className="space-y-2">
                <Button
                  className="w-full bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                  size="lg"
                  disabled={loading || revealedCount === 0}
                  onClick={handleCashout}
                >
                  {loading ? "Processing…" : revealedCount === 0 ? "Reveal a tile first" : `💰 Cash Out ${formatCurrency(potentialPayout)}`}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-red-400/70 hover:text-red-400 hover:bg-red-500/10 text-xs"
                  size="sm"
                  disabled={loading}
                  onClick={handleAbandon}
                >
                  Abandon game (forfeit bet)
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  {activeMinesCount} mines hidden · click tiles to reveal
                </p>
              </div>
            )}

            {(phase === "cashedOut" || phase === "exploded") && (
              <Button
                className="w-full font-bold"
                size="lg"
                onClick={resetGame}
              >
                🔄 Play Again
              </Button>
            )}

            {/* Multiplier reference */}
            {phase === "idle" && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">How it works</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Mines are placed randomly at the start. Each gem you reveal increases your multiplier.
                  Cash out any time to secure your winnings — but if you hit a mine, you lose everything.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
