import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

const VALUE_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function hand21(cards: number[]): number {
  let total = cards.reduce((a, b) => a + b, 0);
  let aces = cards.filter(c => c === 1).length;
  while (aces > 0 && total + 10 <= 21) { total += 10; aces--; }
  return total;
}

export default function BJPvPPage() {
  const { currentMatch, pvpEvent, lastRound, sendAction } = useMultiplayer();
  const [myHand, setMyHand] = useState<number[]>([]);
  const [myTotal, setMyTotal] = useState(0);
  const [oppTotal, setOppTotal] = useState<number | null>(null);
  const [myBusted, setMyBusted] = useState(false);
  const [myStanding, setMyStanding] = useState(false);
  const [done, setDone] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);

  useEffect(() => {
    if (pvpEvent?.event === "bjpvp:dealt" && currentMatch?.gameType === "bjpvp") {
      setMyHand(pvpEvent.data.myHand ?? []);
      setMyTotal(pvpEvent.data.myTotal ?? 0);
    }
  }, [pvpEvent]);

  useEffect(() => {
    if (pvpEvent?.event === "bjpvp:update" && currentMatch?.gameType === "bjpvp") {
      const d = pvpEvent.data;
      setMyHand(d.myHand ?? myHand);
      setMyTotal(d.myTotal ?? myTotal);
      setOppTotal(d.opponentTotal ?? oppTotal);
      if (d.busted) {
        const myId = currentMatch?.opponent?.userId;
        if (d.busted[myId ?? 0]) setMyBusted(true);
      }
      if (d.standing) {
        const myId = currentMatch?.opponent?.userId;
        if (d.standing[myId ?? 0]) setMyStanding(true);
      }
      if (d.bothDone) {
        setDone(true);
        setFinalResult(d);
      }
    }
  }, [pvpEvent]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "bjpvp") {
      setDone(true);
      setFinalResult(lastRound.result);
    }
  }, [lastRound]);

  const handleHit = () => {
    if (!currentMatch || myBusted || myStanding || done) return;
    sendAction(currentMatch.matchId, "hit");
  };

  const handleStand = () => {
    if (!currentMatch || myBusted || myStanding || done) return;
    setMyStanding(true);
    sendAction(currentMatch.matchId, "stand");
  };

  return (
    <PvPGameShell gameType="bjpvp" emoji="🃏" title="Blackjack" roundLabel={() => "Closest to 21"}>
      {({ myId, opponent }) => {
        return (
          <div className="space-y-6">
            <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-3">Your Hand</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {myHand.map((v, i) => (
                    <motion.div
                      key={i}
                      initial={{ rotateY: 90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      className="w-12 h-18 rounded-lg border-2 border-white/20 bg-white flex flex-col items-center justify-center shadow-lg px-2 py-1"
                    >
                      <span className="text-base font-black text-gray-900">{VALUE_LABELS[v] ?? v}</span>
                    </motion.div>
                  ))}
                </div>
                <p className={`mt-3 text-3xl font-black ${myBusted ? "text-red-400" : myTotal >= 21 ? "text-yellow-400" : "text-white"}`}>
                  {myTotal} {myBusted ? "BUST!" : ""}
                </p>
              </div>

              <div className="border-t border-white/5 pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">{opponent.username}'s Total</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {oppTotal !== null ? oppTotal : "?"}
                </p>
              </div>
            </div>

            {!done && !myBusted && !myStanding && (
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={handleHit} className="h-14 text-base">🃏 Hit</Button>
                <Button onClick={handleStand} variant="outline" className="h-14 text-base">🛑 Stand</Button>
              </div>
            )}

            {(myBusted || myStanding) && !done && (
              <p className="text-center text-muted-foreground animate-pulse">Waiting for {opponent.username}...</p>
            )}

            {done && finalResult && (
              <div className={`text-center py-4 rounded-2xl border ${finalResult.gameWinnerId === myId ? "bg-green-500/10 border-green-500/30" : finalResult.gameWinnerId === null ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                <p className={`text-xl font-black ${finalResult.gameWinnerId === myId ? "text-green-400" : finalResult.gameWinnerId === null ? "text-yellow-400" : "text-red-400"}`}>
                  {finalResult.gameWinnerId === myId ? "🏆 You Win!" : finalResult.gameWinnerId === null ? "🤝 Draw!" : "💀 Opponent Wins"}
                </p>
              </div>
            )}
          </div>
        );
      }}
    </PvPGameShell>
  );
}
