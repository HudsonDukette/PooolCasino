import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { GameShell, BetInput } from "@/components/game-shell";
import heroImg from "@/assets/game-war.png";
import { formatCurrency, useCasinoId } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

function CardFace({ label, suit = "♠", color = "text-white", size = "text-5xl" }: { label: string; suit?: string; color?: string; size?: string }) {
  return (
    <div className="w-24 h-36 rounded-xl border-2 border-white/20 bg-gradient-to-br from-white/10 to-white/5 flex flex-col items-center justify-center gap-1 shadow-xl">
      <span className={`${size} font-display font-black ${color}`}>{label}</span>
      <span className={`text-xl ${color}`}>{suit}</span>
    </div>
  );
}

export default function War() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const casinoId = useCasinoId();
  const [betAmount, setBetAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handlePlay() {
    if (!user || user.isGuest) { toast({ title: "Login required", variant: "destructive" }); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < 0.01) { toast({ title: "Minimum bet is $0.01", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}api/games/war`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: bet, ...(casinoId !== undefined ? { casinoId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      if (data.outcome === "win") toast({ title: `🎉 You win! +${formatCurrency(data.payout)}`, className: "bg-success text-success-foreground border-none" });
      else if (data.outcome === "tie") toast({ title: "🤝 Tie — push! Your bet returned." });
      else toast({ title: `❌ Dealer wins. Lost ${formatCurrency(bet)}`, variant: "destructive" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const suitFor = (label: string) => ["K","Q","J"].includes(label) ? "♥" : "♠";
  const colorFor = (label: string) => ["K","Q","J"].includes(label) ? "text-red-400" : "text-white";

  return (
    <GameShell casinoId={casinoId} gameType="war" heroImage={heroImg} title="War" description="Draw a card against the dealer. Higher card wins 2×. Ties push your bet back." accentColor="text-red-400" backHref={casinoId !== undefined ? `/casino/${casinoId}` : "/games"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        <Card className="bg-card/40 border-white/10">
          <CardContent className="p-6 space-y-5">
            <BetInput value={betAmount} onChange={setBetAmount} disabled={loading} />
            <Button className="w-full bg-red-600/90 hover:bg-red-500 text-white font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)]"
              size="lg" disabled={loading} onClick={handlePlay}>
              {loading ? "Drawing cards…" : "⚔️ Go to War"}
            </Button>
            <div className="text-xs text-muted-foreground space-y-1 pt-1">
              <p>• Higher card wins <span className="text-white font-mono">2×</span></p>
              <p>• Tie is a push — bet returned</p>
              <p>• Dealer wins on lower card</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/70 border-white/10">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-6 min-h-[220px]">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 w-full">
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center space-y-2">
                      <p className="text-xs text-muted-foreground">You</p>
                      <CardFace label={result.playerCard} suit={suitFor(result.playerCard)} color={colorFor(result.playerCard)} />
                    </div>
                    <span className="text-2xl font-bold text-muted-foreground">VS</span>
                    <div className="text-center space-y-2">
                      <p className="text-xs text-muted-foreground">Dealer</p>
                      <CardFace label={result.dealerCard} suit={suitFor(result.dealerCard)} color={colorFor(result.dealerCard)} />
                    </div>
                  </div>
                  <div className={`text-center px-4 py-2 rounded-xl border ${
                    result.outcome === "win" ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : result.outcome === "tie" ? "bg-yellow-950/40 border-yellow-500/30 text-yellow-300"
                    : "bg-red-950/40 border-red-500/30 text-red-300"
                  }`}>
                    <p className="text-xl font-bold font-display">
                      {result.outcome === "win" ? `🎉 +${formatCurrency(result.payout)}` : result.outcome === "tie" ? "🤝 Push" : `💀 Lost`}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground text-sm">
                  Cards will appear here
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </GameShell>
  );
}
