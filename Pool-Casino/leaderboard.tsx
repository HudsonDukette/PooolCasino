import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetRichestPlayers,
  useGetBiggestWinners,
  useGetBiggestBettors,
  useGetMe,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Trophy, TrendingUp, DollarSign, Crown, Medal, Flag, X, Gamepad2, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL;

const GAME_DISPLAY_NAMES: Record<string, string> = {
  roulette: "Neon Roulette", plinko: "Drop Plinko", blackjack: "Blackjack",
  crash: "Crash", slots: "Neon Slots", dice: "Dice Roll", coinflip: "Coin Flip",
  wheel: "Fortune Wheel", guess: "Number Guess", mines: "Mines",
  highlow: "High-Low", doubledice: "Double Dice", ladder: "Risk Ladder",
  war: "War", target: "Target Multiplier", icebreak: "Ice Break",
  advwheel: "Advanced Wheel", range: "Range Bet", pyramid: "Pyramid Pick",
  lightning: "Lightning Round",
};

const REPORT_REASONS = [
  "Harassment",
  "Cheating / Exploiting",
  "Hate Speech",
  "Spam / Advertising",
  "Impersonation",
  "Other",
];

type Tab = "richest" | "winners" | "bettors" | "top-games" | "casinos";

function ReportModal({ targetUsername, onClose }: { targetUsername: string; onClose: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    try {
      const r = await fetch(`${BASE}api/reports`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedUsername: targetUsername, reason, details: details.trim() || undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast({ title: "Report Submitted", description: data.message, className: "bg-success text-success-foreground border-none" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setPending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-red-500/30 rounded-2xl p-6 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-red-400">Report {targetUsername}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Reason</label>
          <select value={reason} onChange={e => setReason(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-500/50">
            {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Details (optional)</label>
          <textarea value={details} onChange={e => setDetails(e.target.value)}
            placeholder="Describe what happened..."
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:border-red-500/50" />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
          <Button size="sm" disabled={pending} onClick={submit}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold">
            {pending ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TopCasinosTab() {
  const { toast } = useToast();
  const [casinos, setCasinos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}api/leaderboard/top-casinos`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setCasinos(d.casinos ?? []))
      .catch(() => toast({ title: "Failed to load casinos", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="bg-card/40 border-white/5">
        <CardContent className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-card/20 animate-pulse" />)}
        </CardContent>
      </Card>
    );
  }

  if (casinos.length === 0) {
    return (
      <Card className="bg-card/40 border-white/5">
        <CardContent className="p-0">
          <div className="min-h-[400px] flex flex-col items-center justify-center gap-6 p-8">
            <div className="p-5 bg-primary/10 rounded-full">
              <Building2 className="w-12 h-12 text-primary opacity-50" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-display font-bold">No Casinos Yet</h2>
              <p className="text-muted-foreground max-w-sm">
                No player casinos have been created yet. Be the first — open yours on the{" "}
                <Link href="/casinos" className="text-primary underline underline-offset-2">Casinos page</Link>!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <Card className="bg-card/40 border-white/5 overflow-hidden">
      <CardContent className="p-6 space-y-3">
        {casinos.map((casino, i) => (
          <Link href={`/casino/${casino.id}`} key={casino.id}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 p-3 rounded-xl border border-white/5 hover:border-white/10 bg-card/20 hover:bg-card/30 transition-all cursor-pointer"
            >
              <div className="w-8 text-lg font-bold text-center shrink-0">
                {medals[i] ?? <span className="text-muted-foreground text-sm">#{i + 1}</span>}
              </div>
              <span className="text-3xl shrink-0">{casino.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{casino.name}</p>
                <p className="text-xs text-muted-foreground">by {casino.ownerUsername ?? "Unknown"}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-amber-400">{formatCurrency(parseFloat(casino.bankroll))}</p>
                <p className="text-[10px] text-muted-foreground">{(casino.totalBets ?? 0).toLocaleString()} bets</p>
              </div>
            </motion.div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<Tab>("richest");
  const { data: me } = useGetMe({ query: { retry: false } });
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [topGames, setTopGames] = useState<any[]>([]);
  const [loadingTopGames, setLoadingTopGames] = useState(false);

  const { data: richest, isLoading: loadingRichest } = useGetRichestPlayers({ query: { enabled: activeTab === "richest" } });
  const { data: winners, isLoading: loadingWinners } = useGetBiggestWinners({ query: { enabled: activeTab === "winners" } });
  const { data: bettors, isLoading: loadingBettors } = useGetBiggestBettors({ query: { enabled: activeTab === "bettors" } });

  useEffect(() => {
    if (activeTab === "top-games" && topGames.length === 0) {
      setLoadingTopGames(true);
      fetch(`${BASE}api/leaderboard/top-games`, { credentials: "include" })
        .then(r => r.json())
        .then(d => setTopGames(d.games ?? []))
        .catch(() => {})
        .finally(() => setLoadingTopGames(false));
    }
  }, [activeTab]);

  const tabs = [
    { id: "richest", label: "Richest Players", icon: <Crown className="w-4 h-4" /> },
    { id: "winners", label: "Biggest Winners", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "bettors", label: "High Rollers", icon: <DollarSign className="w-4 h-4" /> },
    { id: "top-games", label: "Top Games", icon: <Gamepad2 className="w-4 h-4" /> },
    { id: "casinos", label: "Top Casinos", icon: <Building2 className="w-4 h-4" /> },
  ] as const;

  const getPlayerData = () => {
    switch (activeTab) {
      case "richest": return { data: richest?.entries || [], loading: loadingRichest };
      case "winners": return { data: winners?.entries || [], loading: loadingWinners };
      case "bettors": return { data: bettors?.entries || [], loading: loadingBettors };
      default: return { data: [], loading: false };
    }
  };

  const isPlayerTab = activeTab === "richest" || activeTab === "winners" || activeTab === "bettors";
  const { data: playerData, loading: playerLoading } = getPlayerData();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      {reportTarget && (
        <ReportModal
          targetUsername={reportTarget}
          onClose={() => setReportTarget(null)}
        />
      )}

      <div className="text-center space-y-4 pt-8 pb-4">
        <div className="inline-flex items-center justify-center p-4 bg-accent/10 rounded-full mb-2">
          <Trophy className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold">Leaderboards</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          The legends of PoolCasino. Do you have what it takes to climb the ranks?
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap justify-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10 max-w-2xl mx-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white/10 text-white shadow-sm"
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Player Boards */}
      {isPlayerTab && (
        <Card className="bg-card/40 border-white/5 overflow-hidden">
          <CardContent className="p-0">
            <div className="px-6 py-4 bg-black/40 border-b border-white/5 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              <div className="w-16">Rank</div>
              <div className="flex-1">Player</div>
              <div className="text-right">Amount</div>
            </div>
            <div className="min-h-[400px]">
              {playerLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : playerData.length > 0 ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="divide-y divide-white/5"
                  >
                    {playerData.map((entry: any, idx: number) => (
                      <div key={entry.username} className={`flex items-center px-6 py-5 hover:bg-white/[0.02] transition-colors group ${idx < 3 ? 'bg-gradient-to-r from-primary/5 to-transparent' : ''}`}>
                        <div className="w-16 flex items-center">
                          {idx === 0 ? <Medal className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" /> :
                           idx === 1 ? <Medal className="w-6 h-6 text-gray-400" /> :
                           idx === 2 ? <Medal className="w-6 h-6 text-amber-700" /> :
                           <span className="font-mono text-muted-foreground font-bold text-lg w-6 text-center">{entry.rank}</span>}
                        </div>
                        <div className="flex-1 flex items-center gap-3 min-w-0">
                          {entry.avatarUrl ? (
                            <img src={entry.avatarUrl} alt={entry.username}
                              className={`w-8 h-8 rounded-full object-cover flex-shrink-0 border ${idx === 0 ? 'border-yellow-400/40' : 'border-white/10'}`} />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-yellow-400/20 text-yellow-400' : 'bg-white/10 text-white'}`}>
                              {entry.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex items-center gap-2 min-w-0">
                            <Link href={`/player/${encodeURIComponent(entry.username)}`}
                              className={`font-bold text-lg hover:underline cursor-pointer truncate ${idx < 3 ? 'text-white' : 'text-muted-foreground hover:text-white'}`}>
                              {entry.username}
                            </Link>
                            {entry.isBanned && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium flex-shrink-0">
                                {entry.permanentlyBanned ? "Perm Ban" : "Banned"}
                              </span>
                            )}
                            {!entry.isBanned && entry.isSuspended && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium flex-shrink-0">
                                Suspended
                              </span>
                            )}
                          </div>
                          {me && me.username !== entry.username && (
                            <button
                              onClick={() => setReportTarget(entry.username)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1 rounded flex-shrink-0"
                              title={`Report ${entry.username}`}
                            >
                              <Flag className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-right flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground uppercase tracking-widest hidden sm:inline">{entry.label}</span>
                          <span className={`font-mono font-bold text-xl ${idx === 0 ? 'text-primary neon-text-primary' : 'text-white'}`}>
                            {formatCurrency(entry.value)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <Trophy className="w-12 h-12 mb-4 opacity-20" />
                  <p>No data available yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Grossing Games */}
      {activeTab === "top-games" && (
        <Card className="bg-card/40 border-white/5 overflow-hidden">
          <CardContent className="p-0">
            <div className="px-6 py-4 bg-black/40 border-b border-white/5 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              <div className="w-16">Rank</div>
              <div className="flex-1">Game</div>
              <div className="text-right hidden sm:block">Bets</div>
              <div className="text-right ml-4">Total Wagered</div>
            </div>
            <div className="min-h-[400px]">
              {loadingTopGames ? (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : topGames.length > 0 ? (
                <AnimatePresence mode="wait">
                  <motion.div key="top-games" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="divide-y divide-white/5">
                    {topGames.map((g: any, idx: number) => (
                      <div key={g.gameType} className={`flex items-center px-6 py-4 hover:bg-white/[0.02] transition-colors ${idx < 3 ? 'bg-gradient-to-r from-primary/5 to-transparent' : ''}`}>
                        <div className="w-16 flex items-center">
                          {idx === 0 ? <Medal className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" /> :
                           idx === 1 ? <Medal className="w-6 h-6 text-gray-400" /> :
                           idx === 2 ? <Medal className="w-6 h-6 text-amber-700" /> :
                           <span className="font-mono text-muted-foreground font-bold text-lg w-6 text-center">{g.rank}</span>}
                        </div>
                        <div className="flex-1 flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-primary/20 text-primary`}>
                            <Gamepad2 className="w-4 h-4" />
                          </div>
                          <Link href={`/games/${g.gameType}`} className={`font-bold text-lg hover:underline cursor-pointer truncate ${idx < 3 ? 'text-white' : 'text-muted-foreground hover:text-white'}`}>
                            {GAME_DISPLAY_NAMES[g.gameType] ?? g.gameType}
                          </Link>
                        </div>
                        <div className="text-right hidden sm:block text-muted-foreground text-sm mr-4">
                          {g.totalBets.toLocaleString()} bets
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`font-mono font-bold text-xl ${idx === 0 ? 'text-primary neon-text-primary' : 'text-white'}`}>
                            {formatCurrency(g.totalWagered)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <Gamepad2 className="w-12 h-12 mb-4 opacity-20" />
                  <p>No game data yet. Play some games to populate this board!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Casinos — Live */}
      {activeTab === "casinos" && <TopCasinosTab />}
    </div>
  );
}
