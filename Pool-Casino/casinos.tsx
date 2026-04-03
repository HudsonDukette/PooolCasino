import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { formatNumber } from "@/lib/utils";
import {
  Building2, Plus, TrendingUp, Coins, Gamepad2,
  Search, RefreshCw, AlertCircle, ChevronRight,
  Lock, Pause, Users, PauseCircle, CheckCircle2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

interface CasinoListing {
  id: number;
  name: string;
  description: string;
  emoji: string;
  bankroll: string;
  minBet: string;
  maxBet: string;
  isPaused: boolean;
  totalBets: number;
  totalWagered: string;
  totalPaidOut: string;
  gameCount: number;
  activePlayers: number;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  ownerId: number;
  createdAt: string;
}

function CreateCasinoModal({ onClose, onCreated, userBalance }: {
  onClose: () => void;
  onCreated: () => void;
  userBalance: number;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🏦");
  const [loading, setLoading] = useState(false);

  const COST = 100_000_000;
  const canAfford = userBalance >= COST;

  const create = async () => {
    if (!name.trim()) { toast({ title: "Enter a casino name", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/casinos`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), emoji }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed to create casino", variant: "destructive" }); return; }
      toast({ title: `🏦 ${name} opened!`, description: "Your casino is live. Head to the hub to configure it." });
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  const EMOJIS = ["🏦", "🎰", "🎲", "🃏", "💎", "👑", "🌟", "🔥", "💜", "🎪", "🏛️", "🌙"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md bg-card border border-white/10 rounded-2xl p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-display font-bold mb-1">Open Your Casino</h2>
        <p className="text-sm text-muted-foreground mb-6">
          One-time cost of <span className="text-amber-400 font-semibold">100,000,000 chips</span> — paid to the prize pool.
        </p>

        {!canAfford && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>You need {formatNumber(COST - userBalance)} more chips to create a casino.</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Casino Emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`text-2xl p-2 rounded-lg border transition-colors ${emoji === e ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/20"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Casino Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Lucky Dragon Casino"
              maxLength={40}
              className="bg-background/50"
            />
            <span className="text-xs text-muted-foreground">{name.length}/40</span>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell players what makes your casino special..."
              maxLength={300}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <span className="text-xs text-muted-foreground">{description.length}/300</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={create}
            disabled={loading || !canAfford || !name.trim()}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {loading ? "Opening..." : `${emoji} Open Casino`}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function CasinoCard({ casino }: { casino: CasinoListing }) {
  const bankroll = parseFloat(casino.bankroll);
  const profit = parseFloat(casino.totalWagered) - parseFloat(casino.totalPaidOut);

  return (
    <Link href={`/casino/${casino.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2, scale: 1.01 }}
        className="cursor-pointer"
      >
        <Card className="bg-card/40 border-white/5 hover:border-white/15 transition-all overflow-hidden group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{casino.emoji}</span>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-white truncate">{casino.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    by <span className="text-white/70">{casino.ownerUsername ?? "Unknown"}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {casino.isPaused ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center gap-1">
                    <PauseCircle className="w-3 h-3" /> Paused
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Open
                  </span>
                )}
              </div>
            </div>

            {casino.description && (
              <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">{casino.description}</p>
            )}

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-background/30 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Bankroll</p>
                <p className="text-xs font-bold text-amber-400">{formatNumber(bankroll)}</p>
              </div>
              <div className="bg-background/30 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Games</p>
                <p className="text-xs font-bold text-purple-400">{casino.gameCount}</p>
              </div>
              <div className="bg-background/30 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Active</p>
                <p className={`text-xs font-bold ${casino.activePlayers > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                  {casino.activePlayers > 0 ? (
                    <span className="flex items-center justify-center gap-0.5">
                      <Users className="w-3 h-3" />{casino.activePlayers}
                    </span>
                  ) : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Min: <span className="text-white/60">{formatNumber(parseFloat(casino.minBet))}</span></span>
                <span>Max: <span className="text-white/60">{formatNumber(parseFloat(casino.maxBet))}</span></span>
                <span className="text-white/30">·</span>
                <span>{formatNumber(casino.totalBets)} bets</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white/70 transition-colors" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}

export default function Casinos() {
  const [, navigate] = useLocation();
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const [casinos, setCasinos] = useState<CasinoListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [ownedCasinoId, setOwnedCasinoId] = useState<number | null>(null);

  const fetchCasinos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/casinos`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCasinos(data.casinos ?? []);
      }
    } catch {
      toast({ title: "Failed to load casinos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const checkOwnedCasino = useCallback(async () => {
    if (!me) return;
    try {
      const res = await fetch(`${BASE}api/casinos/me/owned`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setOwnedCasinoId(data.casino?.id ?? null);
      }
    } catch {}
  }, [me]);

  useEffect(() => { fetchCasinos(); }, [fetchCasinos]);
  useEffect(() => { checkOwnedCasino(); }, [checkOwnedCasino]);

  const filtered = casinos.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.ownerUsername ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const userBalance = me ? me.balance : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            Player Casinos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {casinos.length} casino{casinos.length !== 1 ? "s" : ""} open — owned and operated by players
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={fetchCasinos}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {me && (
            ownedCasinoId ? (
              <Button onClick={() => navigate(`/casino/${ownedCasinoId}`)} className="bg-primary hover:bg-primary/90">
                <Building2 className="w-4 h-4 mr-2" /> My Casino
              </Button>
            ) : (
              <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white">
                <Plus className="w-4 h-4 mr-2" /> Open Casino
              </Button>
            )
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
        <span className="text-2xl shrink-0">🏦</span>
        <div className="text-sm">
          <p className="font-medium text-amber-300 mb-0.5">Player-Owned Casinos</p>
          <p className="text-muted-foreground">
            Pay 100M chips to open your own casino. Purchase game licenses for 1M chips each. Set your own bet limits and bankroll.
            A <strong className="text-white/70">10% monthly tax</strong> on your bankroll goes back to the pool. Earn from every bet placed at your casino!
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search casinos or owners..."
          className="pl-9 bg-background/50"
        />
      </div>

      {/* Casino grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-card/20 border-white/5 animate-pulse">
              <CardContent className="p-5 h-44" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <Building2 className="w-16 h-16 opacity-10" />
          <div className="text-center">
            <p className="font-medium">No casinos found</p>
            <p className="text-sm mt-1">
              {search ? "Try a different search" : "Be the first to open a casino!"}
            </p>
          </div>
          {!search && !ownedCasinoId && me && (
            <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" /> Open First Casino
            </Button>
          )}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
        >
          {filtered.map(casino => (
            <CasinoCard key={casino.id} casino={casino} />
          ))}
        </motion.div>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateCasinoModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              fetchCasinos();
              checkOwnedCasino();
            }}
            userBalance={userBalance}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
