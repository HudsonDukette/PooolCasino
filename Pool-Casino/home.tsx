import React, { useRef } from "react";
import { Link } from "wouter";
import { useGetPool, useGetMe, useGetRecentBigWins } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dices, ArrowRight, TrendingUp, Zap, Activity, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import rouletteImg from "@/assets/game-roulette.png";
import plinkoImg from "@/assets/game-plinko.png";
import crashImg from "@/assets/game-crash.png";
import slotsImg from "@/assets/game-slots.png";

/** Pops + glows whenever `value` changes by using the value as the React key */
function AnimatedStat({
  value,
  className,
  glowColor = "rgba(0,255,170,0.8)",
}: {
  value: string;
  className?: string;
  glowColor?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        initial={{ scale: 1.3, textShadow: `0 0 24px ${glowColor}` }}
        animate={{ scale: 1, textShadow: `0 0 0px ${glowColor}` }}
        transition={{ type: "spring", stiffness: 380, damping: 18, duration: 0.4 }}
        className={className}
        style={{ display: "block", width: "100%" }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

function poolFontClass(text: string): string {
  if (text.length > 22) return "text-base md:text-lg";
  if (text.length > 18) return "text-lg md:text-xl";
  if (text.length > 14) return "text-xl md:text-2xl";
  if (text.length > 11) return "text-2xl md:text-3xl";
  return "text-4xl md:text-5xl";
}

function subStatFontClass(text: string): string {
  if (text.length > 18) return "text-xs";
  if (text.length > 14) return "text-sm";
  if (text.length > 10) return "text-base";
  return "text-lg";
}

const FEATURED = [
  {
    href: "/games/roulette",
    name: "Neon Roulette",
    desc: "Classic game with dynamic pool-based odds. Choose red or black and ride the spin.",
    img: rouletteImg,
    imgAlt: "Roulette",
    accent: "primary",
    hoverClass: "hover:shadow-[0_0_30px_rgba(0,255,170,0.15)] hover:border-primary/50",
    btnClass: "group-hover:text-primary",
    imgClass: "group-hover:rotate-180",
    badge: "🔴 Red or Black",
  },
  {
    href: "/games/plinko",
    name: "Drop Plinko",
    desc: "Drop the ball, hit the multipliers. Control your risk to hunt for massive payouts.",
    img: plinkoImg,
    imgAlt: "Plinko",
    accent: "secondary",
    hoverClass: "hover:shadow-[0_0_30px_rgba(255,0,255,0.15)] hover:border-secondary/50",
    btnClass: "group-hover:text-secondary",
    imgClass: "group-hover:-translate-y-2",
    badge: "⬇️ Physics Drop",
  },
  {
    href: "/games/crash",
    name: "Crash",
    desc: "Watch the rocket climb and cash out before the market crashes. Every second counts.",
    img: crashImg,
    imgAlt: "Crash",
    accent: "red",
    hoverClass: "hover:shadow-[0_0_30px_rgba(239,68,68,0.15)] hover:border-red-500/50",
    btnClass: "group-hover:text-red-400",
    imgClass: "group-hover:scale-110",
    badge: "🚀 Thrill Bet",
  },
  {
    href: "/games/slots",
    name: "Neon Slots",
    desc: "Spin the reels, match the symbols. Sevens pay 20×, diamonds pay 10×, and more!",
    img: slotsImg,
    imgAlt: "Slots",
    accent: "pink",
    hoverClass: "hover:shadow-[0_0_30px_rgba(236,72,153,0.15)] hover:border-pink-500/50",
    btnClass: "group-hover:text-pink-400",
    imgClass: "group-hover:scale-105",
    badge: "🎰 Match 3",
  },
];

const GAME_ICONS = [
  { emoji: "🎰", label: "Slots" },
  { emoji: "🎲", label: "Dice" },
  { emoji: "🃏", label: "Blackjack" },
  { emoji: "🎡", label: "Wheel" },
  { emoji: "💣", label: "Mines" },
  { emoji: "🪙", label: "Coin" },
  { emoji: "🎯", label: "Guess" },
  { emoji: "🚀", label: "Crash" },
  { emoji: "🎳", label: "Plinko" },
  { emoji: "🎰", label: "Roulette" },
];

export default function Home() {
  const { data: pool, isLoading: isPoolLoading } = useGetPool({ query: { refetchInterval: 5000 } });
  const { data: user } = useGetMe({ query: { retry: false } });
  const { data: recentWins } = useGetRecentBigWins({ query: { refetchInterval: 10000 } });

  const poolStr   = isPoolLoading ? "Loading..." : formatCurrency(pool?.totalAmount || 0);
  const bigBetStr = isPoolLoading ? "-" : formatCurrency(pool?.biggestBet || 0);
  const bigWinStr = isPoolLoading ? "-" : formatCurrency(pool?.biggestWin || 0);

  const prevPool = useRef<number | null>(null);
  const poolNum  = parseFloat(String(pool?.totalAmount ?? "0"));
  const grew     = prevPool.current !== null && poolNum > prevPool.current;
  if (pool) prevPool.current = poolNum;

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
        {/* Animated gradient background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-black to-secondary/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,255,170,0.12),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,0,255,0.08),transparent_60%)]" />
          {/* Floating game icon particles */}
          <div className="absolute inset-0 overflow-hidden opacity-[0.07] pointer-events-none">
            {GAME_ICONS.map((g, i) => (
              <motion.span
                key={i}
                className="absolute text-4xl select-none"
                style={{
                  left: `${8 + (i * 9.5) % 90}%`,
                  top: `${10 + (i * 17) % 75}%`,
                }}
                animate={{ y: [0, -12, 0], rotate: [-4, 4, -4] }}
                transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
              >
                {g.emoji}
              </motion.span>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
        </div>

        <div className="relative z-10 px-6 py-16 md:py-24 lg:px-16 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Global Pool Active
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-bold leading-tight">
              Play against the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent neon-text-primary">
                Global Economy
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Every bet shapes the pool. When you lose, the pool grows. When you win, you take from the community. How much will you claim?
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/games">
                <Button size="lg" className="w-full sm:w-auto text-lg shadow-[0_0_30px_rgba(0,255,170,0.3)] hover:shadow-[0_0_40px_rgba(0,255,170,0.5)]">
                  <Dices className="mr-2 w-5 h-5" />
                  Play Now
                </Button>
              </Link>
              {!user && (
                <Link href="/register">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg">
                    <Sparkles className="mr-2 w-4 h-4" />
                    Claim Free Coins
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Pool Stats Widget */}
          <div className="w-full md:w-auto md:min-w-[340px] md:max-w-[420px]">
            <Card className="bg-black/60 backdrop-blur-2xl border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-accent to-secondary" />
              <CardContent className="p-8 space-y-8">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Current Global Pool
                  </p>
                  <div className={`font-mono font-bold tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] w-full whitespace-nowrap ${poolFontClass(poolStr)}`}>
                    <AnimatedStat
                      value={poolStr}
                      glowColor={grew ? "rgba(0,255,170,0.9)" : "rgba(255,100,100,0.8)"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Biggest Bet</p>
                    <p className={`font-mono font-medium text-primary whitespace-nowrap ${subStatFontClass(bigBetStr)}`}>
                      <AnimatedStat value={bigBetStr} glowColor="rgba(0,255,170,0.8)" />
                    </p>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Biggest Win</p>
                    <p className={`font-mono font-medium text-accent whitespace-nowrap ${subStatFontClass(bigWinStr)}`}>
                      <AnimatedStat value={bigWinStr} glowColor="rgba(255,170,0,0.8)" />
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-display font-bold">Featured Games</h2>
          <Link href="/games" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURED.map((game) => (
            <Link key={game.href} href={game.href} className="group block">
              <Card className={`h-full overflow-hidden transition-all duration-500 hover:scale-[1.02] border-white/5 relative ${game.hoverClass}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-0 flex flex-col sm:flex-row h-full">
                  <div className="p-7 flex-1 flex flex-col justify-center space-y-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground w-fit font-medium">{game.badge}</span>
                    <h3 className={`text-xl font-display font-bold transition-colors duration-300 ${game.btnClass.replace("group-hover:", "group-hover:")}`}>
                      {game.name}
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-2">{game.desc}</p>
                    <div className="pt-1">
                      <Button variant="ghost" className={`px-0 ${game.btnClass}`}>
                        Play Game <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                  <div className="w-full sm:w-2/5 min-h-[160px] bg-black/50 flex items-center justify-center p-5 border-t sm:border-t-0 sm:border-l border-white/5 overflow-hidden">
                    <img
                      src={game.img}
                      alt={game.imgAlt}
                      className={`w-full h-36 object-cover rounded-xl transition-transform duration-700 ease-out ${game.imgClass}`}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Live Feed */}
      <section>
        <Card className="bg-black/40 border-white/5 overflow-hidden">
          <div className="flex items-center px-6 py-4 border-b border-white/5 bg-white/5">
            <TrendingUp className="w-5 h-5 text-accent mr-3" />
            <h2 className="text-lg font-bold">Live Big Wins</h2>
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="ml-3 w-2 h-2 rounded-full bg-green-400"
            />
          </div>
          <div className="p-0 overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-4 p-6 min-w-max">
              <AnimatePresence initial={false}>
                {recentWins?.wins && recentWins.wins.length > 0 ? (
                  recentWins.wins.map((win, i) => (
                    <motion.div
                      key={`${win.timestamp}-${win.username}`}
                      initial={{ opacity: 0, x: 40, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.9 }}
                      transition={{ delay: i * 0.06, type: "spring", stiffness: 320, damping: 22 }}
                      className="flex-shrink-0 flex items-center gap-4 px-5 py-3 rounded-2xl bg-white/5 border border-white/10"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{win.username}</span>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide bg-black/50 px-2 py-0.5 rounded">{win.gameType}</span>
                        </div>
                        <div className="font-mono text-green-400 font-semibold">
                          <AnimatedStat
                            value={`+${formatCurrency(win.payout)}`}
                            glowColor="rgba(0,255,100,0.7)"
                            className="text-green-400"
                          />
                          {win.multiplier && <span className="text-muted-foreground text-xs ml-2">({win.multiplier}×)</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground text-sm"
                  >
                    No recent big wins. Be the first!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
