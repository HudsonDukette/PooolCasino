import React, { useState, useEffect } from "react";
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

interface FlipResult {
  won: boolean;
  choice: string;
  result: string;
  payout: number;
  multiplier: number;
  newBalance: number;
}

function CoinFace({ side }: { side: "heads" | "tails" }) {
  return (
    <div className={`w-full h-full rounded-full flex items-center justify-center text-5xl select-none
      ${side === "heads"
        ? "bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 shadow-[0_0_40px_rgba(250,204,21,0.6)]"
        : "bg-gradient-to-br from-slate-400 via-slate-500 to-slate-700 shadow-[0_0_40px_rgba(148,163,184,0.5)]"
      }`}
    >
      {side === "heads" ? "👑" : "⚡"}
    </div>
  );
}

function Coin({ side, flipping }: { side: "heads" | "tails"; flipping: boolean }) {
  const [showSide, setShowSide] = useState<"heads" | "tails">(side);

  useEffect(() => {
    if (!flipping) {
      setShowSide(side);
      return;
    }
    // Alternate sides while flipping for realism
    let toggle = true;
    const iv = setInterval(() => {
      setShowSide(toggle ? "heads" : "tails");
      toggle = !toggle;
    }, 120);
    return () => clearInterval(iv);
  }, [flipping, side]);

  return (
    <div style={{ perspective: "600px" }} className="w-36 h-36">
      <motion.div
        animate={flipping
          ? { rotateY: [0, 180, 360, 540, 720, 900, 1080] }
          : { rotateY: 0 }
        }
        transition={flipping
          ? { duration: 0.9, ease: "easeInOut" }
          : { duration: 0.4, type: "spring", stiffness: 200 }
        }
        className="w-full h-full rounded-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div className="absolute inset-0 rounded-full border-4 border-yellow-400/50" style={{ backfaceVisibility: "hidden" }}>
          <CoinFace side={showSide} />
        </div>
        {/* Back */}
        <div className="absolute inset-0 rounded-full border-4 border-yellow-400/50" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <CoinFace side={showSide === "heads" ? "tails" : "heads"} />
        </div>
      </motion.div>
    </div>
  );
}

export default function CoinFlip() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const api = useGameApi<FlipResult>();
  const casinoId = useCasinoId();

  const [betAmount, setBetAmount] = useState("10");
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [coinSide, setCoinSide] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<FlipResult | null>(null);

  const bet = parseFloat(betAmount) || 0;

  async function handleFlip() {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }

    setFlipping(true);
    setResult(null);

    const data = await api.call("coinflip", { betAmount: bet, choice, casinoId });

    setTimeout(() => {
      setFlipping(false);
      if (!data) {
        toast({ title: "Bet failed", description: api.error ?? "Something went wrong", variant: "destructive" });
        return;
      }
      if (data) {
        setCoinSide(data.result as "heads" | "tails");
        setResult(data);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        toast({
          title: data.won ? `${data.result === "heads" ? "👑" : "⚡"} ${data.result.toUpperCase()}!` : `It's ${data.result}!`,
          description: data.won ? `Won ${formatCurrency(data.payout)}!` : `Lost ${formatCurrency(bet)}`,
          variant: data.won ? "default" : "destructive",
        });
      }
    }, 950);
  }

  return (
    <GameShell casinoId={casinoId} gameType="coinflip" payTableEntries={GAME_PAY_TABLES.coinflip} title="Coin Flip" description="Pick heads or tails. Win 1.95× your bet." accentColor="text-yellow-400">
      <Card className="bg-card/40 border-white/10">
        <CardContent className="p-8 space-y-8">
          <div className="flex flex-col items-center gap-8">
            {/* Coin with drop shadow */}
            <div className="relative flex flex-col items-center gap-3">
              <Coin side={flipping ? choice : coinSide} flipping={flipping} />
              {/* Shadow */}
              <motion.div
                animate={flipping ? { scaleX: [0.6, 1, 0.6], opacity: [0.3, 0.6, 0.3] } : { scaleX: 0.85, opacity: 0.4 }}
                transition={flipping ? { duration: 0.9, ease: "easeInOut" } : {}}
                className="w-28 h-3 bg-black/50 rounded-full blur-md -mt-1"
              />
            </div>

            {/* Choice buttons */}
            <div className="flex gap-4">
              {(["heads", "tails"] as const).map(side => (
                <motion.button
                  key={side}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => !flipping && !api.loading && setChoice(side)}
                  disabled={flipping || api.loading}
                  className={`px-8 py-4 rounded-2xl border-2 font-display font-bold text-lg transition-all duration-200 ${
                    choice === side
                      ? "border-yellow-400 bg-yellow-400/20 text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                      : "border-white/10 bg-white/5 text-white hover:border-white/30"
                  }`}
                >
                  {side === "heads" ? "👑 Heads" : "⚡ Tails"}
                </motion.button>
              ))}
            </div>

            {/* Bet */}
            <div className="w-full max-w-sm space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Bet Amount</p>
              <BetInput value={betAmount} onChange={setBetAmount} disabled={flipping || api.loading} />
            </div>

            {api.error && <p className="text-sm text-destructive">{api.error}</p>}

            <motion.div whileTap={{ scale: 0.97 }} className="w-full max-w-sm">
              <Button
                size="lg"
                className="w-full bg-yellow-500/90 hover:bg-yellow-400 text-black font-bold shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_35px_rgba(250,204,21,0.5)]"
                disabled={flipping || api.loading}
                onClick={handleFlip}
              >
                {flipping ? "Flipping…" : "Flip Coin (1.95×)"}
              </Button>
            </motion.div>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className={`text-center px-6 py-4 rounded-2xl w-full max-w-sm ${
                    result.won
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-destructive/10 border border-destructive/30"
                  }`}
                >
                  <p className={`text-2xl font-display font-bold ${result.won ? "text-primary" : "text-destructive"}`}>
                    {result.won ? "🎉 You Win!" : "You Lose"}
                  </p>
                  <p className="text-muted-foreground text-sm mt-1">
                    {result.won ? `+${formatCurrency(result.payout)}` : `-${formatCurrency(bet)}`}
                    {" · "}Balance: {formatCurrency(result.newBalance)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </GameShell>
  );
}
