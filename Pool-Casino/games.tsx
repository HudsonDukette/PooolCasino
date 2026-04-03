import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useGetPool } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import rouletteImg from "@/assets/game-roulette.png";
import plinkoImg from "@/assets/game-plinko.png";
import blackjackImg from "@/assets/game-blackjack.png";
import crashImg from "@/assets/game-crash.png";
import slotsImg from "@/assets/game-slots.png";
import diceImg from "@/assets/game-dice.png";
import coinflipImg from "@/assets/game-coinflip.png";
import wheelImg from "@/assets/game-wheel.png";
import guessImg from "@/assets/game-guess.png";
import minesImg from "@/assets/game-mines.png";
import highlowImg from "@/assets/game-highlow.png";
import doublediceImg from "@/assets/game-doubledice.png";
import ladderImg from "@/assets/game-ladder.png";
import warImg from "@/assets/game-war.png";
import targetImg from "@/assets/game-target.png";
import icebreakImg from "@/assets/game-icebreak.png";
import advwheelImg from "@/assets/game-advwheel.png";
import rangeImg from "@/assets/game-range.png";
import pyramidImg from "@/assets/game-pyramid.png";
import lightningImg from "@/assets/game-lightning.png";
import blinddrawImg from "@/assets/game-blinddraw.png";
import hiddenpathImg from "@/assets/game-hiddenpath.png";
import jackpothuntImg from "@/assets/game-jackpothunt.png";
import targethitImg from "@/assets/game-targethit.png";
import chainreactionImg from "@/assets/game-chainreaction.png";
import timedsafeImg from "@/assets/game-timedsafe.png";
import reversecrashImg from "@/assets/game-reversecrash.png";
import countdownImg from "@/assets/game-countdown.png";
import cardstackImg from "@/assets/game-cardstack.png";
import powergridImg from "@/assets/game-powergrid.png";
import elimwheelImg from "@/assets/game-elimwheel.png";
import combobuilderImg from "@/assets/game-combobuilder.png";
import safestepsImg from "@/assets/game-safesteps.png";
import predchainImg from "@/assets/game-predchain.png";

const games = [
  {
    id: "roulette",
    name: "Neon Roulette",
    description: "Classic red or black with dynamic odds based on the global pool.",
    image: rouletteImg,
    href: "/games/roulette",
    accentClass: "group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(0,255,170,0.2)]",
    titleClass: "group-hover:text-primary",
    tag: "Classic",
    tagColor: "bg-primary/20 text-primary",
  },
  {
    id: "plinko",
    name: "Drop Plinko",
    description: "Drop the ball through the pegs. Control your risk for massive multipliers.",
    image: plinkoImg,
    href: "/games/plinko",
    accentClass: "group-hover:border-secondary/50 group-hover:shadow-[0_0_30px_rgba(255,0,255,0.2)]",
    titleClass: "group-hover:text-secondary",
    tag: "Physics",
    tagColor: "bg-secondary/20 text-secondary",
  },
  {
    id: "blackjack",
    name: "Blackjack",
    description: "Race to 21 against the dealer. Hit or Stand. Blackjack pays 2.5×.",
    image: blackjackImg,
    href: "/games/blackjack",
    accentClass: "group-hover:border-green-500/50 group-hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]",
    titleClass: "group-hover:text-green-400",
    tag: "Strategy",
    tagColor: "bg-green-500/20 text-green-400",
  },
  {
    id: "crash",
    name: "Crash",
    description: "Watch the multiplier climb and cash out before it crashes. Set your target and launch.",
    image: crashImg,
    href: "/games/crash",
    accentClass: "group-hover:border-red-500/50 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]",
    titleClass: "group-hover:text-red-400",
    tag: "Thrill",
    tagColor: "bg-red-500/20 text-red-400",
  },
  {
    id: "slots",
    name: "Neon Slots",
    description: "Match all 3 reels to win. Sevens pay 20×, diamonds pay 10×, and more!",
    image: slotsImg,
    href: "/games/slots",
    accentClass: "group-hover:border-pink-500/50 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.2)]",
    titleClass: "group-hover:text-pink-400",
    tag: "Luck",
    tagColor: "bg-pink-500/20 text-pink-400",
  },
  {
    id: "dice",
    name: "Dice Roll",
    description: "Guess exact (5×) or pick high/low (1.9×). Simple, fast, addictive.",
    image: diceImg,
    href: "/games/dice",
    accentClass: "group-hover:border-yellow-500/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]",
    titleClass: "group-hover:text-yellow-400",
    tag: "Quick",
    tagColor: "bg-yellow-500/20 text-yellow-400",
  },
  {
    id: "coinflip",
    name: "Coin Flip",
    description: "The simplest bet. Pick heads or tails and double your money. 1.95× on win.",
    image: coinflipImg,
    href: "/games/coinflip",
    accentClass: "group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]",
    titleClass: "group-hover:text-amber-400",
    tag: "50/50",
    tagColor: "bg-amber-500/20 text-amber-400",
  },
  {
    id: "wheel",
    name: "Fortune Wheel",
    description: "Spin the wheel and land on multipliers from 0.2× to 10×. Rarer segments = bigger rewards.",
    image: wheelImg,
    href: "/games/wheel",
    accentClass: "group-hover:border-purple-500/50 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]",
    titleClass: "group-hover:text-purple-400",
    tag: "Spin",
    tagColor: "bg-purple-500/20 text-purple-400",
  },
  {
    id: "guess",
    name: "Number Guess",
    description: "Guess 1–100. Exact match pays 50×! Within 1 pays 10×. The closer, the bigger.",
    image: guessImg,
    href: "/games/guess",
    accentClass: "group-hover:border-cyan-500/50 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]",
    titleClass: "group-hover:text-cyan-400",
    tag: "Precision",
    tagColor: "bg-cyan-500/20 text-cyan-400",
  },
  {
    id: "mines",
    name: "Mines",
    description: "Choose your mines, reveal safe tiles one by one, and cash out before you explode.",
    image: minesImg,
    href: "/games/mines",
    accentClass: "group-hover:border-orange-500/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]",
    titleClass: "group-hover:text-orange-400",
    tag: "Risk",
    tagColor: "bg-orange-500/20 text-orange-400",
  },
  // ── New Games ──
  {
    id: "highlow",
    name: "High-Low",
    description: "Draw a card, then guess if the next is higher or lower. Correct pays 1.85×. Ties push.",
    image: highlowImg,
    href: "/games/highlow",
    accentClass: "group-hover:border-yellow-500/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]",
    titleClass: "group-hover:text-yellow-400",
    tag: "Card",
    tagColor: "bg-yellow-500/20 text-yellow-400",
  },
  {
    id: "doubledice",
    name: "Double Dice",
    description: "Roll two dice. Bet even/odd (1.9×) or nail the exact sum for up to 18× payout.",
    image: doublediceImg,
    href: "/games/doubledice",
    accentClass: "group-hover:border-orange-500/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]",
    titleClass: "group-hover:text-orange-400",
    tag: "Dice",
    tagColor: "bg-orange-500/20 text-orange-400",
  },
  {
    id: "ladder",
    name: "Risk Ladder",
    description: "Climb 10 rungs with escalating multipliers up to 30×. Cash out anytime — or risk it all.",
    image: ladderImg,
    href: "/games/ladder",
    accentClass: "group-hover:border-lime-500/50 group-hover:shadow-[0_0_30px_rgba(132,204,22,0.2)]",
    titleClass: "group-hover:text-lime-400",
    tag: "Stateful",
    tagColor: "bg-lime-500/20 text-lime-400",
  },
  {
    id: "war",
    name: "War",
    description: "Draw a card against the dealer. Higher card wins 2×. Tie returns your bet.",
    image: warImg,
    href: "/games/war",
    accentClass: "group-hover:border-red-500/50 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]",
    titleClass: "group-hover:text-red-400",
    tag: "Card",
    tagColor: "bg-red-500/20 text-red-400",
  },
  {
    id: "target",
    name: "Target Multiplier",
    description: "Pick your target (1.5× to 50×). Higher targets are harder to hit — but reward more.",
    image: targetImg,
    href: "/games/target",
    accentClass: "group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]",
    titleClass: "group-hover:text-blue-400",
    tag: "Pick",
    tagColor: "bg-blue-500/20 text-blue-400",
  },
  {
    id: "icebreak",
    name: "Ice Break",
    description: "16 tiles hide 4 danger spots. Flip tiles — miss all dangers to win up to 10×.",
    image: icebreakImg,
    href: "/games/icebreak",
    accentClass: "group-hover:border-cyan-500/50 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]",
    titleClass: "group-hover:text-cyan-400",
    tag: "Grid",
    tagColor: "bg-cyan-500/20 text-cyan-400",
  },
  {
    id: "advwheel",
    name: "Advanced Wheel",
    description: "9-segment wheel with payouts up to 50×. Bigger jackpots than Fortune Wheel.",
    image: advwheelImg,
    href: "/games/advwheel",
    accentClass: "group-hover:border-purple-500/50 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]",
    titleClass: "group-hover:text-purple-400",
    tag: "Jackpot",
    tagColor: "bg-purple-500/20 text-purple-400",
  },
  {
    id: "range",
    name: "Range Bet",
    description: "A number 1–100 is drawn. Pick your range: narrow (4.75×) or wide (1.9×).",
    image: rangeImg,
    href: "/games/range",
    accentClass: "group-hover:border-teal-500/50 group-hover:shadow-[0_0_30px_rgba(20,184,166,0.2)]",
    titleClass: "group-hover:text-teal-400",
    tag: "Range",
    tagColor: "bg-teal-500/20 text-teal-400",
  },
  {
    id: "pyramid",
    name: "Pyramid Pick",
    description: "Climb pyramid levels (50/50 each). Survive 5 levels to win 23×.",
    image: pyramidImg,
    href: "/games/pyramid",
    accentClass: "group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]",
    titleClass: "group-hover:text-amber-400",
    tag: "Levels",
    tagColor: "bg-amber-500/20 text-amber-400",
  },
  {
    id: "lightning",
    name: "Lightning Round",
    description: "3, 5, or 10 rapid 50/50 flips at 1.9× each. Win as many rounds as you can.",
    image: lightningImg,
    href: "/games/lightning",
    accentClass: "group-hover:border-yellow-400/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.3)]",
    titleClass: "group-hover:text-yellow-300",
    tag: "Rapid",
    tagColor: "bg-yellow-400/20 text-yellow-300",
  },
  // ── New Solo Games ──
  {
    id: "blinddraw",
    name: "Blind Draw",
    image: blinddrawImg,
    description: "Draw a face-down card — it's a mystery multiplier or a loss. Pure fate.",
    href: "/games/blinddraw",
    accentClass: "group-hover:border-indigo-500/50 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]",
    titleClass: "group-hover:text-indigo-400",
    tag: "Luck",
    tagColor: "bg-indigo-500/20 text-indigo-400",
  },
  {
    id: "hiddenpath",
    name: "Hidden Path",
    image: hiddenpathImg,
    description: "Pick a path through 3 hidden forks. All safe = 8× win. One wrong turn = bust.",
    href: "/games/hiddenpath",
    accentClass: "group-hover:border-emerald-500/50 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]",
    titleClass: "group-hover:text-emerald-400",
    tag: "Risk",
    tagColor: "bg-emerald-500/20 text-emerald-400",
  },
  {
    id: "jackpothunt",
    name: "Jackpot Hunt",
    image: jackpothuntImg,
    description: "Open 1 of 5 boxes. One hides a 10× jackpot. Others give small wins or losses.",
    href: "/games/jackpothunt",
    accentClass: "group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]",
    titleClass: "group-hover:text-amber-400",
    tag: "Jackpot",
    tagColor: "bg-amber-500/20 text-amber-400",
  },
  {
    id: "targethit",
    name: "Target Hit",
    image: targethitImg,
    description: "Click the moving target. A perfect hit pays up to 5×. Narrow window, big reward.",
    href: "/games/targethit",
    accentClass: "group-hover:border-rose-500/50 group-hover:shadow-[0_0_30px_rgba(244,63,94,0.2)]",
    titleClass: "group-hover:text-rose-400",
    tag: "Skill",
    tagColor: "bg-rose-500/20 text-rose-400",
  },
  {
    id: "chainreaction",
    name: "Chain Reaction",
    image: chainreactionImg,
    description: "Each win chains a bigger multiplier. One loss wipes your chain. Cash out anytime.",
    href: "/games/chainreaction",
    accentClass: "group-hover:border-orange-500/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]",
    titleClass: "group-hover:text-orange-400",
    tag: "Chain",
    tagColor: "bg-orange-500/20 text-orange-400",
  },
  {
    id: "timedsafe",
    name: "Timed Safe",
    image: timedsafeImg,
    description: "A safe opens over 10 seconds. Cash out early for less, or wait for a bigger prize.",
    href: "/games/timedsafe",
    accentClass: "group-hover:border-slate-400/50 group-hover:shadow-[0_0_30px_rgba(148,163,184,0.2)]",
    titleClass: "group-hover:text-slate-300",
    tag: "Timing",
    tagColor: "bg-slate-500/20 text-slate-300",
  },
  {
    id: "reversecrash",
    name: "Reverse Crash",
    image: reversecrashImg,
    description: "Multiplier starts at 10× and falls fast. Cash out before it crashes below 1×.",
    href: "/games/reversecrash",
    accentClass: "group-hover:border-pink-500/50 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.2)]",
    titleClass: "group-hover:text-pink-400",
    tag: "Thrill",
    tagColor: "bg-pink-500/20 text-pink-400",
  },
  {
    id: "countdown",
    name: "Countdown Gamble",
    image: countdownImg,
    description: "Multiplier grows as the timer ticks down. Cash out before it hits zero or lose it all.",
    href: "/games/countdown",
    accentClass: "group-hover:border-yellow-500/50 group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]",
    titleClass: "group-hover:text-yellow-400",
    tag: "Race",
    tagColor: "bg-yellow-500/20 text-yellow-400",
  },
  {
    id: "cardstack",
    name: "Card Stack",
    image: cardstackImg,
    description: "Draw cards to build your stack without going over 21. Push your luck, one card at a time.",
    href: "/games/cardstack",
    accentClass: "group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]",
    titleClass: "group-hover:text-blue-400",
    tag: "Card",
    tagColor: "bg-blue-500/20 text-blue-400",
  },
  {
    id: "powergrid",
    name: "Power Grid",
    image: powergridImg,
    description: "A 4×4 grid of multipliers — pick tiles strategically. Hit a trap and lose everything.",
    href: "/games/powergrid",
    accentClass: "group-hover:border-lime-500/50 group-hover:shadow-[0_0_30px_rgba(132,204,22,0.2)]",
    titleClass: "group-hover:text-lime-400",
    tag: "Grid",
    tagColor: "bg-lime-500/20 text-lime-400",
  },
  {
    id: "elimwheel",
    name: "Elimination Wheel",
    image: elimwheelImg,
    description: "Each spin removes the worst segment. 5 rounds, last segment wins a massive payout.",
    href: "/games/elimwheel",
    accentClass: "group-hover:border-violet-500/50 group-hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]",
    titleClass: "group-hover:text-violet-400",
    tag: "Spin",
    tagColor: "bg-violet-500/20 text-violet-400",
  },
  {
    id: "combobuilder",
    name: "Combo Builder",
    image: combobuilderImg,
    description: "Win streaks stack your combo multiplier. One loss resets it to zero. How high can you go?",
    href: "/games/combobuilder",
    accentClass: "group-hover:border-red-500/50 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]",
    titleClass: "group-hover:text-red-400",
    tag: "Streak",
    tagColor: "bg-red-500/20 text-red-400",
  },
  {
    id: "safesteps",
    name: "Safe Steps",
    image: safestepsImg,
    description: "Step forward for higher rewards. Each step raises the fail chance. Cash out or climb.",
    href: "/games/safesteps",
    accentClass: "group-hover:border-teal-500/50 group-hover:shadow-[0_0_30px_rgba(20,184,166,0.2)]",
    titleClass: "group-hover:text-teal-400",
    tag: "Levels",
    tagColor: "bg-teal-500/20 text-teal-400",
  },
  {
    id: "predchain",
    name: "Prediction Chain",
    image: predchainImg,
    description: "Predict 3 coin flips in a row. Each correct adds to your chain. Get all 3 for 6.5× payout.",
    href: "/games/predchain",
    accentClass: "group-hover:border-fuchsia-500/50 group-hover:shadow-[0_0_30px_rgba(217,70,239,0.2)]",
    titleClass: "group-hover:text-fuchsia-400",
    tag: "Predict",
    tagColor: "bg-fuchsia-500/20 text-fuchsia-400",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function Games() {
  const { data: pool } = useGetPool({ query: { refetchInterval: 5000 } });
  const disabledGames = pool?.disabledGames ?? [];
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-4 pt-8 pb-4"
      >
        <h1 className="text-4xl md:text-5xl font-display font-bold">Casino Games</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          34 games. One global pool. Every bet matters.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {games.map((game) => {
          const g = game as any;
          const hasImage = !!g.image;
          const isDisabled = disabledGames.includes(game.id);

          const thumbnail = hasImage ? (
            <div className="h-[160px] relative overflow-hidden border-b border-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent z-10" />
              {isDisabled ? (
                <img src={g.image} alt={game.name} className="w-full h-full object-cover grayscale" />
              ) : (
                <motion.img src={g.image} alt={game.name} className="w-full h-full object-cover"
                  whileHover={{ scale: 1.06 }} transition={{ duration: 0.5, ease: "easeOut" }} />
              )}
            </div>
          ) : (
            <div className={`h-[160px] relative overflow-hidden border-b border-white/5 bg-gradient-to-br ${g.emojiGradient ?? "from-white/5 to-transparent"} flex items-center justify-center`}>
              <span className="text-7xl select-none">{g.emoji}</span>
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
            </div>
          );

          if (isDisabled) {
            return (
              <motion.div key={game.id} variants={item}>
                <Card className="h-full overflow-hidden bg-card/20 border-white/5 relative opacity-50 cursor-not-allowed select-none">
                  <div className="absolute top-3 right-3 z-20">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.tagColor}`}>{game.tag}</span>
                  </div>
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                    <div className="text-center space-y-1">
                      <p className="text-2xl">🔧</p>
                      <p className="text-xs font-medium text-yellow-400">Temporarily Unavailable</p>
                    </div>
                  </div>
                  <CardContent className="p-0 flex flex-col h-[280px]">
                    {thumbnail}
                    <div className="p-5 flex-1 flex flex-col justify-center space-y-1.5">
                      <h3 className="text-xl font-display font-bold text-white/40">{game.name}</h3>
                      <p className="text-muted-foreground/50 text-xs line-clamp-2 leading-relaxed">{game.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          }

          return (
            <motion.div key={game.id} variants={item}>
              <Link href={game.href} className="block group h-full">
                <Card className={`h-full overflow-hidden transition-all duration-500 bg-card/40 border-white/5 relative cursor-pointer ${game.accentClass}`}>
                  <div className="absolute top-3 right-3 z-20">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.tagColor}`}>{game.tag}</span>
                  </div>
                  <CardContent className="p-0 flex flex-col h-[280px]">
                    {thumbnail}
                    <div className="p-5 flex-1 flex flex-col justify-center space-y-1.5">
                      <h3 className={`text-xl font-display font-bold transition-colors duration-300 ${game.titleClass}`}>
                        {game.name}
                      </h3>
                      <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed">
                        {game.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
