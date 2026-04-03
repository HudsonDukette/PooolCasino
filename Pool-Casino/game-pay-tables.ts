import type { PayTableEntry } from "@/components/casino-game-editor";

export const GAME_PAY_TABLES: Record<string, PayTableEntry[]> = {
  slots: [
    { key: "seven",   label: "Seven (7️⃣7️⃣7️⃣)",   emoji: "7️⃣", defaultValue: 20, min: 2,   max: 200 },
    { key: "diamond", label: "Diamond (💎💎💎)", emoji: "💎", defaultValue: 10, min: 2,   max: 100 },
    { key: "bell",    label: "Bell (🔔🔔🔔)",    emoji: "🔔", defaultValue: 5,  min: 1,   max: 50  },
    { key: "orange",  label: "Orange (🍊🍊🍊)",  emoji: "🍊", defaultValue: 3,  min: 1,   max: 30  },
    { key: "cherry",  label: "Cherry (🍒🍒🍒)",  emoji: "🍒", defaultValue: 2,  min: 1,   max: 20  },
    { key: "lemon",   label: "Lemon (🍋🍋🍋)",   emoji: "🍋", defaultValue: 2,  min: 1,   max: 20  },
  ],

  wheel: [
    { key: "seg0", label: "Segment 1 (lose)",   emoji: "💔", defaultValue: 0.2, min: 0.0, max: 2  },
    { key: "seg1", label: "Segment 2 (lose)",   emoji: "😞", defaultValue: 0.5, min: 0.0, max: 2  },
    { key: "seg2", label: "Segment 3 (break)",  emoji: "😐", defaultValue: 1.0, min: 0.1, max: 3  },
    { key: "seg3", label: "Segment 4 (win)",    emoji: "😊", defaultValue: 1.5, min: 1.0, max: 5  },
    { key: "seg4", label: "Segment 5 (win)",    emoji: "😄", defaultValue: 2.0, min: 1.0, max: 10 },
    { key: "seg5", label: "Segment 6 (win)",    emoji: "🤑", defaultValue: 3.0, min: 1.0, max: 20 },
    { key: "seg6", label: "Segment 7 (big)",    emoji: "🎉", defaultValue: 5.0, min: 1.0, max: 50 },
    { key: "seg7", label: "Segment 8 (jackpot)",emoji: "💰", defaultValue: 10.0,min: 1.0, max: 100},
  ],

  coinflip: [
    { key: "win", label: "Correct call", emoji: "🪙", defaultValue: 1.95, min: 1.1, max: 10 },
  ],

  dice: [
    { key: "exact", label: "Exact number hit",  emoji: "🎯", defaultValue: 5,   min: 2,  max: 50  },
    { key: "high",  label: "High (4, 5, 6)",    emoji: "⬆️", defaultValue: 1.9, min: 1.1,max: 10  },
    { key: "low",   label: "Low (1, 2, 3)",     emoji: "⬇️", defaultValue: 1.9, min: 1.1,max: 10  },
  ],

  doubledice: [
    { key: "even",    label: "Even total",         emoji: "⚖️", defaultValue: 1.9,  min: 1.1, max: 10  },
    { key: "odd",     label: "Odd total",          emoji: "🎲", defaultValue: 1.9,  min: 1.1, max: 10  },
    { key: "exact2",  label: "Exact sum (2 dice)", emoji: "🎯", defaultValue: 8.0,  min: 2,   max: 50  },
  ],

  guess: [
    { key: "exact",  label: "Exact match (0 off)", emoji: "🎯", defaultValue: 50,  min: 5,  max: 500 },
    { key: "near1",  label: "Off by 1",            emoji: "⭐", defaultValue: 10,  min: 2,  max: 100 },
    { key: "near5",  label: "Off by 2-5",          emoji: "🌟", defaultValue: 3,   min: 1,  max: 20  },
    { key: "near10", label: "Off by 6-10",         emoji: "✨", defaultValue: 2,   min: 1,  max: 10  },
    { key: "near20", label: "Off by 11-20",        emoji: "💫", defaultValue: 1.5, min: 1,  max: 5   },
  ],

  blackjack: [
    { key: "bj",   label: "Natural Blackjack (21)", emoji: "🃏", defaultValue: 2.5, min: 1.5, max: 5  },
    { key: "win",  label: "Standard win",           emoji: "✅", defaultValue: 2.0, min: 1.5, max: 4  },
  ],

  highlow: [
    { key: "win", label: "Correct guess", emoji: "🃏", defaultValue: 1.85, min: 1.1, max: 10 },
  ],

  pyramid: [
    { key: "l1",  label: "Level 1",  emoji: "1️⃣", defaultValue: 1.9,  min: 1.1, max: 5   },
    { key: "l2",  label: "Level 2",  emoji: "2️⃣", defaultValue: 3.8,  min: 1.1, max: 10  },
    { key: "l3",  label: "Level 3",  emoji: "3️⃣", defaultValue: 7.5,  min: 2,   max: 20  },
    { key: "l4",  label: "Level 4",  emoji: "4️⃣", defaultValue: 15,   min: 5,   max: 50  },
    { key: "l5",  label: "Level 5",  emoji: "5️⃣", defaultValue: 30,   min: 10,  max: 100 },
    { key: "l6",  label: "Level 6",  emoji: "6️⃣", defaultValue: 60,   min: 15,  max: 200 },
    { key: "l7",  label: "Level 7",  emoji: "7️⃣", defaultValue: 120,  min: 30,  max: 500 },
    { key: "l8",  label: "Level 8",  emoji: "8️⃣", defaultValue: 240,  min: 50,  max: 1000},
    { key: "l9",  label: "Level 9",  emoji: "9️⃣", defaultValue: 480,  min: 100, max: 2000},
    { key: "l10", label: "Level 10", emoji: "🏆", defaultValue: 960,  min: 200, max: 5000},
  ],

  crash: [
    { key: "houseEdge", label: "House edge %", emoji: "🏦", defaultValue: 5, min: 0, max: 20 },
  ],

  mines: [
    { key: "base", label: "Base payout (per safe tile)", emoji: "💣", defaultValue: 1.1, min: 1.01, max: 2 },
  ],

  ladder: [
    { key: "step1",  label: "Step 1 multiplier",  emoji: "1️⃣", defaultValue: 1.5, min: 1.1, max: 5   },
    { key: "step2",  label: "Step 2 multiplier",  emoji: "2️⃣", defaultValue: 2.25,min: 1.1, max: 10  },
    { key: "step3",  label: "Step 3 multiplier",  emoji: "3️⃣", defaultValue: 3.4, min: 1.5, max: 20  },
    { key: "step4",  label: "Step 4 multiplier",  emoji: "4️⃣", defaultValue: 5.1, min: 2,   max: 50  },
    { key: "step5",  label: "Step 5 multiplier",  emoji: "5️⃣", defaultValue: 7.7, min: 3,   max: 100 },
  ],

  lightning: [
    { key: "stage1", label: "Stage 1 multiplier", emoji: "⚡", defaultValue: 1.5, min: 1.1, max: 5   },
    { key: "stage2", label: "Stage 2 multiplier", emoji: "⚡", defaultValue: 2.5, min: 1.5, max: 10  },
    { key: "stage3", label: "Stage 3 multiplier", emoji: "⚡", defaultValue: 5.0, min: 2,   max: 25  },
    { key: "stage4", label: "Stage 4 multiplier", emoji: "⚡", defaultValue: 10,  min: 5,   max: 50  },
  ],

  countdown: [
    { key: "mult", label: "Per-second multiplier", emoji: "⏱️", defaultValue: 0.3, min: 0.1, max: 1 },
  ],

  icebreak: [
    { key: "safe",  label: "Safe tile bonus (×)", emoji: "🧊", defaultValue: 0.25, min: 0.1, max: 2 },
  ],

  safesteps: [
    { key: "step", label: "Multiplier per step", emoji: "👣", defaultValue: 1.4, min: 1.1, max: 3 },
  ],

  hiddenpath: [
    { key: "step", label: "Multiplier per step", emoji: "🔍", defaultValue: 1.3, min: 1.1, max: 3 },
  ],

  blinddraw: [
    { key: "win", label: "Win multiplier", emoji: "🃏", defaultValue: 2, min: 1.1, max: 10 },
  ],

  cardstack: [
    { key: "win", label: "Win multiplier", emoji: "🎴", defaultValue: 2, min: 1.1, max: 10 },
  ],

  chainreaction: [
    { key: "win", label: "Win multiplier", emoji: "💥", defaultValue: 2, min: 1.1, max: 10 },
  ],

  combobuilder: [
    { key: "win", label: "Win multiplier", emoji: "🔗", defaultValue: 2, min: 1.1, max: 10 },
  ],

  elimwheel: [
    { key: "win", label: "Win multiplier", emoji: "🎡", defaultValue: 5, min: 2, max: 25 },
  ],

  jackpothunt: [
    { key: "jackpot", label: "Jackpot multiplier", emoji: "🎰", defaultValue: 20, min: 5, max: 200 },
    { key: "small",   label: "Small win multiplier",emoji: "✨", defaultValue: 2,  min: 1.1, max: 10 },
  ],

  powergrid: [
    { key: "win", label: "Win multiplier", emoji: "⚡", defaultValue: 2, min: 1.1, max: 10 },
  ],

  predchain: [
    { key: "chain3", label: "3-chain win", emoji: "🔗", defaultValue: 2,  min: 1.1, max: 10 },
    { key: "chain5", label: "5-chain win", emoji: "⛓️", defaultValue: 5,  min: 2,   max: 25  },
    { key: "chain7", label: "7+ chain win",emoji: "💎", defaultValue: 10, min: 3,   max: 100 },
  ],

  reversecrash: [
    { key: "win", label: "Win multiplier", emoji: "🔄", defaultValue: 2, min: 1.1, max: 10 },
  ],

  targethit: [
    { key: "bullseye", label: "Bullseye", emoji: "🎯", defaultValue: 10, min: 2, max: 100 },
    { key: "hit",      label: "Ring hit",  emoji: "⭕", defaultValue: 2,  min: 1.1, max: 10 },
  ],

  timedsafe: [
    { key: "win", label: "Win multiplier", emoji: "🔐", defaultValue: 2, min: 1.1, max: 10 },
  ],

  advwheel: [
    { key: "seg0", label: "Segment 1 (lowest)", emoji: "💔", defaultValue: 0.1, min: 0.0, max: 2  },
    { key: "seg1", label: "Segment 2",          emoji: "😞", defaultValue: 0.5, min: 0.0, max: 2  },
    { key: "seg2", label: "Segment 3",          emoji: "😐", defaultValue: 1.0, min: 0.1, max: 3  },
    { key: "seg3", label: "Segment 4",          emoji: "😊", defaultValue: 2.0, min: 1.0, max: 10 },
    { key: "seg4", label: "Segment 5",          emoji: "🤑", defaultValue: 5.0, min: 1.0, max: 25 },
    { key: "seg5", label: "Segment 6 (jackpot)",emoji: "💰", defaultValue: 25,  min: 5,   max: 200},
  ],
};
