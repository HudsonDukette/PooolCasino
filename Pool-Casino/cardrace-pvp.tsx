import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { Button } from "@/components/ui/button";
import PvPGameShell from "@/components/PvPGameShell";

export default function CardRacePvP() {
  const { currentMatch, pvpEvent, lastRound, sendAction } = useMultiplayer();
  const [myTotal, setMyTotal] = useState(0);
  const [oppTotal, setOppTotal] = useState(0);
  const [myBusted, setMyBusted] = useState(false);
  const [myStanding, setMyStanding] = useState(false);
  const [oppStanding, setOppStanding] = useState(false);
  const [oppBusted, setOppBusted] = useState(false);
  const [lastCard, setLastCard] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);

  useEffect(() => {
    if (pvpEvent?.event === "cardrace:update" && currentMatch?.gameType === "cardrace") {
      const d = pvpEvent.data;
      setLastCard(d.drawnCard);
    }
  }, [pvpEvent]);

  useEffect(() => {
    if (lastRound && currentMatch?.gameType === "cardrace") {
      const res = lastRound.result;
      setMyTotal(res.totals[currentMatch.opponent.userId] ?? myTotal);
      setDone(res.bothDone);
      setWinner(res.gameWinnerId);
    }
  }, [lastRound]);

  const handleDraw = () => {
    if (!currentMatch || myBusted || myStanding || done) return;
    sendAction(currentMatch.matchId, "draw");
  };

  const handleStand = () => {
    if (!currentMatch || myBusted || myStanding || done) return;
    setMyStanding(true);
    sendAction(currentMatch.matchId, "stand");
  };

  useEffect(() => {
    if (pvpEvent?.event === "cardrace:update" && currentMatch?.gameType === "cardrace") {
      const d = pvpEvent.data;
      const myId = currentMatch ? undefined : undefined;
    }
  }, [pvpEvent, currentMatch]);

  return (
    <PvPGameShell gameType="cardrace" emoji="🃏" title="Card Draw Race" roundLabel={() => "Race to 21"}>
      {({ myId, opponent }) => {
        const handleDrawCards = () => {
          if (!currentMatch || myBusted || myStanding || done) return;
          sendAction(currentMatch.matchId, "draw");
        };

        const handleStandNow = () => {
          if (!currentMatch || myBusted || myStanding || done) return;
          setMyStanding(true);
          sendAction(currentMatch.matchId, "stand");
        };

        return (
          <div className="space-y-6">
            <div className="bg-black/20 border border-white/5 rounded-2xl p-8 space-y-6">
              <p className="text-center text-sm text-muted-foreground">Draw cards to get as close to 21 as possible without going over!</p>

              <div className="grid grid-cols-2 gap-6">
                <div className={`bg-black/30 rounded-xl p-4 text-center border ${myBusted ? "border-red-500/40" : myStanding ? "border-yellow-500/40" : "border-white/10"}`}>
                  <p className="text-xs text-muted-foreground mb-2">You</p>
                  <p className="text-4xl font-black text-white">{myTotal}</p>
                  <p className="text-xs mt-1">
                    {myBusted ? <span className="text-red-400">BUST!</span> :
                     myStanding ? <span className="text-yellow-400">Standing</span> :
                     <span className="text-muted-foreground">Drawing</span>}
                  </p>
                </div>
                <div className={`bg-black/30 rounded-xl p-4 text-center border ${oppBusted ? "border-red-500/40" : oppStanding ? "border-yellow-500/40" : "border-white/10"}`}>
                  <p className="text-xs text-muted-foreground mb-2">{opponent.username}</p>
                  <p className="text-4xl font-black text-white">?</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    {oppStanding ? <span className="text-yellow-400">Standing</span> : "Drawing"}
                  </p>
                </div>
              </div>

              {lastCard && (
                <motion.div
                  key={lastCard}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <span className="text-sm text-muted-foreground">Last card drawn: </span>
                  <span className="text-white font-bold">+{lastCard}</span>
                </motion.div>
              )}
            </div>

            {!myBusted && !myStanding && !done && (
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={handleDrawCards} className="h-14 text-base">🃏 Draw Card</Button>
                <Button onClick={handleStandNow} variant="outline" className="h-14 text-base">🛑 Stand</Button>
              </div>
            )}

            {(myBusted || myStanding) && !done && (
              <p className="text-center text-muted-foreground">Waiting for {opponent.username} to finish...</p>
            )}
          </div>
        );
      }}
    </PvPGameShell>
  );
}
