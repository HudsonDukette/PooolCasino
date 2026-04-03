import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetMe,
  useAdminRefillPool,
  useAdminRefillPlayer,
  useAdminListPlayers,
  useAdminResetAllBalances,
  useAdminSeize,
  useAdminGetSettings,
  useAdminUpdateSettings,
  useGetPool,
} from "@workspace/api-client-react";
import type { AdminPlayer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  ShieldAlert, ShieldCheck, RefreshCw, Users, X, Plus, ArrowRight,
  Settings, Gamepad2, Power, PowerOff, Megaphone, Building2,
  CheckCircle2, XCircle, Clock, BanknoteIcon, ChevronDown,
  Flag, Trash2, UserX, UserCheck, Edit2, AlertTriangle, Eye, Link2,
  Ban, MicOff, MessageCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL;

function PlayerStatusIcons({ player }: { player: any }) {
  const now = new Date();
  const isBanned = player.permanentlyBanned || (player.bannedUntil && new Date(player.bannedUntil) > now);
  const isSuspended = !isBanned && player.suspendedUntil && new Date(player.suspendedUntil) > now;
  if (!isBanned && !isSuspended) return null;
  return (
    <span className="flex items-center gap-1 ml-1">
      {isBanned && <span title={player.permanentlyBanned ? "Permanently Banned" : `Banned until ${new Date(player.bannedUntil).toLocaleDateString()}`}><Ban className="w-3 h-3 text-red-400" /></span>}
      {isSuspended && <span title={`Chat suspended until ${new Date(player.suspendedUntil).toLocaleDateString()}`}><MicOff className="w-3 h-3 text-yellow-400" /></span>}
    </span>
  );
}

function MoneyRequestRow({ req, onFulfill, onDismiss, loading }: { req: any; onFulfill: (id: number, amt: string) => void; onDismiss: (id: number) => void; loading: boolean }) {
  const [fulfillAmt, setFulfillAmt] = useState(req.amount?.toString() ?? "10000");
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{req.username ?? "Unknown"}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
            req.status === "pending" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" :
            req.status === "fulfilled" ? "bg-green-500/10 border-green-500/30 text-green-400" :
            "bg-white/5 border-white/10 text-muted-foreground"
          }`}>
            {req.status === "pending" ? <><Clock className="w-2.5 h-2.5 inline mr-1" />Pending</> :
             req.status === "fulfilled" ? <><CheckCircle2 className="w-2.5 h-2.5 inline mr-1" />Fulfilled</> :
             <><XCircle className="w-2.5 h-2.5 inline mr-1" />Dismissed</>}
          </span>
          <span className="text-xs font-mono text-green-400 font-bold">${parseFloat(req.amount ?? 0).toLocaleString()}</span>
        </div>
        {req.message && <p className="text-xs text-muted-foreground italic truncate">"{req.message}"</p>}
        <p className="text-[10px] text-muted-foreground/60">{new Date(req.createdAt).toLocaleString()}</p>
      </div>
      {req.status === "pending" && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <input type="number" min="1" value={fulfillAmt} onChange={e => setFulfillAmt(e.target.value)}
              className="pl-5 pr-2 py-1.5 w-28 rounded-lg bg-black/40 border border-white/10 font-mono text-xs outline-none focus:border-green-500/50" />
          </div>
          <Button size="sm" onClick={() => onFulfill(req.id, fulfillAmt)} disabled={loading}
            className="bg-green-600 hover:bg-green-500 text-white h-8 gap-1 text-xs whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" /> Fulfill
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDismiss(req.id)} disabled={loading}
            className="text-muted-foreground hover:text-red-400 h-8 text-xs">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

const ALL_GAMES = [
  { id: "roulette",      name: "Neon Roulette",      emoji: "🎡" },
  { id: "plinko",        name: "Drop Plinko",         emoji: "🔮" },
  { id: "blackjack",     name: "Blackjack",           emoji: "🃏" },
  { id: "crash",         name: "Crash",               emoji: "📈" },
  { id: "slots",         name: "Neon Slots",          emoji: "🎰" },
  { id: "dice",          name: "Dice Roll",           emoji: "🎲" },
  { id: "coinflip",      name: "Coin Flip",           emoji: "🪙" },
  { id: "wheel",         name: "Fortune Wheel",       emoji: "🎡" },
  { id: "guess",         name: "Number Guess",        emoji: "🔢" },
  { id: "mines",         name: "Mines",               emoji: "💣" },
  { id: "highlow",       name: "High-Low",            emoji: "🃏" },
  { id: "doubledice",    name: "Double Dice",         emoji: "🎲" },
  { id: "ladder",        name: "Risk Ladder",         emoji: "🪜" },
  { id: "war",           name: "War",                 emoji: "⚔️" },
  { id: "target",        name: "Target Multiplier",   emoji: "🎯" },
  { id: "icebreak",      name: "Ice Break",           emoji: "❄️" },
  { id: "advwheel",      name: "Advanced Wheel",      emoji: "🎡" },
  { id: "range",         name: "Range Bet",           emoji: "📊" },
  { id: "pyramid",       name: "Pyramid Pick",        emoji: "🔺" },
  { id: "lightning",     name: "Lightning Round",     emoji: "⚡" },
  { id: "blinddraw",     name: "Blind Draw",          emoji: "🎴" },
  { id: "hiddenpath",    name: "Hidden Path",         emoji: "🔍" },
  { id: "jackpothunt",   name: "Jackpot Hunt",        emoji: "🏆" },
  { id: "targethit",     name: "Target Hit",          emoji: "🎯" },
  { id: "countdown",     name: "Countdown",           emoji: "⏱️" },
  { id: "cardstack",     name: "Card Stack",          emoji: "🃏" },
  { id: "powergrid",     name: "Power Grid",          emoji: "⚡" },
  { id: "elimwheel",     name: "Elimination Wheel",   emoji: "🎰" },
  { id: "combobuilder",  name: "Combo Builder",       emoji: "🎰" },
  { id: "chainreaction", name: "Chain Reaction",      emoji: "💥" },
  { id: "reversecrash",  name: "Reverse Crash",       emoji: "📉" },
  { id: "safesteps",     name: "Safe Steps",          emoji: "🪜" },
  { id: "predchain",     name: "Prediction Chain",    emoji: "🔮" },
  { id: "timedsafe",     name: "Timed Safe",          emoji: "⏰" },
];

function SectionHeader({
  title, icon, badge, accent, isOpen, onToggle
}: {
  title: string; icon: React.ReactNode; badge?: React.ReactNode;
  accent: string; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-5 text-left">
      <div className={`flex items-center gap-2.5 font-semibold text-lg ${accent}`}>
        {icon} {title} {badge}
      </div>
      <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
    </button>
  );
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: pool } = useGetPool({ query: { refetchInterval: 5000 } });
  const { data: playersData, isLoading: playersLoading, refetch: refetchPlayers } = useAdminListPlayers({
    query: { enabled: !!user?.isAdmin },
  });
  const { data: adminSettings, refetch: refetchSettings } = useAdminGetSettings({ query: { enabled: !!user?.isAdmin } });

  const refillPoolMut = useAdminRefillPool();
  const refillPlayerMut = useAdminRefillPlayer();
  const resetAllBalancesMut = useAdminResetAllBalances();
  const seizesMut = useAdminSeize();
  const updateSettingsMut = useAdminUpdateSettings();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const isOpen = (key: string) => openSections[key] ?? false;

  const [poolRefillAmount, setPoolRefillAmount] = useState("1000000");
  const [selectedPlayer, setSelectedPlayer] = useState<AdminPlayer | null>(null);
  const [playerRefillAmount, setPlayerRefillAmount] = useState("10000");
  const [balanceMode, setBalanceMode] = useState<"add" | "subtract">("add");
  const [resetBalanceAmount, setResetBalanceAmount] = useState("10000");
  const [confirmReset, setConfirmReset] = useState(false);
  const [forceReloadPending, setForceReloadPending] = useState(false);
  const [seizePlayers, setSeizePlayers] = useState<{ id: number; username: string } | null>(null);
  const [seizeAmount, setSeizeAmount] = useState("10000");
  const [seizeDestination, setSeizeDestination] = useState<"pool" | "user">("pool");
  const [seizeToUserId, setSeizeToUserId] = useState<number | null>(null);
  const [adminUsernameCost, setAdminUsernameCost] = useState("");
  const [adminAvatarCost, setAdminAvatarCost] = useState("");
  const [disabledGames, setDisabledGames] = useState<string[]>([]);
  const [togglingGame, setTogglingGame] = useState<string | null>(null);
  const [moneyRequests, setMoneyRequests] = useState<any[]>([]);
  const [mrLoading, setMrLoading] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastPending, setBroadcastPending] = useState(false);
  const [removeGuestsPending, setRemoveGuestsPending] = useState(false);
  const [confirmRemoveGuests, setConfirmRemoveGuests] = useState(false);

  const [managedPlayer, setManagedPlayer] = useState<AdminPlayer | null>(null);
  const [managedAction, setManagedAction] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [suspendHours, setSuspendHours] = useState("24");
  const [banHours, setBanHours] = useState("168");
  const [banReason, setBanReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [viewingChats, setViewingChats] = useState<{ userId: number; username: string; messages: any[] } | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(false);

  const [adminCasinos, setAdminCasinos] = useState<any[]>([]);
  const [casinosLoading, setCasinosLoading] = useState(false);
  const [casinoAction, setCasinoAction] = useState<{ id: number; type: "sell" | "delete" } | null>(null);
  const [casinoActionLoading, setCasinoActionLoading] = useState(false);

  const [ownerStartingBalance, setOwnerStartingBalance] = useState("10000");
  const [ownerResetConfirm, setOwnerResetConfirm] = useState(false);
  const [ownerResetPending, setOwnerResetPending] = useState(false);
  const [ownerResetOptions, setOwnerResetOptions] = useState({ resetPool: true, deleteCasinos: true, deleteStats: true });

  const isOwner = (user as any)?.isOwner === true;

  const loadMoneyRequests = React.useCallback(async () => {
    if (!user?.isAdmin) return;
    try {
      const r = await fetch(`${BASE}api/admin/money-requests`, { credentials: "include" });
      const data = await r.json();
      setMoneyRequests(data.requests ?? []);
    } catch {}
  }, [user?.isAdmin]);

  const loadReports = React.useCallback(async () => {
    if (!user?.isAdmin) return;
    setReportsLoading(true);
    try {
      const r = await fetch(`${BASE}api/admin/reports`, { credentials: "include" });
      const data = await r.json();
      setReports(data.reports ?? []);
    } catch {} finally { setReportsLoading(false); }
  }, [user?.isAdmin]);

  const loadAppeals = React.useCallback(async () => {
    if (!user?.isAdmin) return;
    setAppealsLoading(true);
    try {
      const r = await fetch(`${BASE}api/admin/appeals`, { credentials: "include" });
      const data = await r.json();
      setAppeals(data.appeals ?? []);
    } catch {} finally { setAppealsLoading(false); }
  }, [user?.isAdmin]);

  const loadAdminCasinos = React.useCallback(async () => {
    if (!user?.isAdmin) return;
    setCasinosLoading(true);
    try {
      const r = await fetch(`${BASE}api/admin/casinos`, { credentials: "include" });
      const data = await r.json();
      setAdminCasinos(data.casinos ?? []);
    } catch {} finally { setCasinosLoading(false); }
  }, [user?.isAdmin]);

  useEffect(() => { loadMoneyRequests(); }, [loadMoneyRequests]);

  const fulfillRequest = async (id: number, amount: string) => {
    setMrLoading(true);
    try {
      const r = await fetch(`${BASE}api/admin/money-requests/${id}/fulfill`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast({ title: "Fulfilled!", description: data.message, className: "bg-success text-success-foreground border-none" });
      loadMoneyRequests();
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setMrLoading(false); }
  };

  const dismissRequest = async (id: number) => {
    try {
      await fetch(`${BASE}api/admin/money-requests/${id}/dismiss`, { method: "POST", credentials: "include" });
      loadMoneyRequests();
    } catch {}
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcastPending(true);
    try {
      const r = await fetch(`${BASE}api/admin/broadcast`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: broadcastMsg.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast({ title: "Broadcast Sent!", description: data.message, className: "bg-success text-success-foreground border-none" });
      setBroadcastMsg("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setBroadcastPending(false); }
  };

  const adjustedAmount = balanceMode === "subtract"
    ? -(parseFloat(playerRefillAmount) || 0)
    : (parseFloat(playerRefillAmount) || 0);
  const refillPreviewBalance = selectedPlayer ? selectedPlayer.balance + adjustedAmount : null;

  useEffect(() => {
    if (adminSettings) {
      setAdminUsernameCost(adminSettings.usernameChangeCost.toString());
      setAdminAvatarCost(adminSettings.avatarChangeCost.toString());
      setDisabledGames(adminSettings.disabledGames ?? []);
    }
  }, [adminSettings]);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) setLocation("/");
  }, [user, isLoading, setLocation]);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!user?.isAdmin) return null;

  const handleRefillPool = () => {
    const amount = parseFloat(poolRefillAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    refillPoolMut.mutate({ data: { amount } }, {
      onSuccess: (data) => {
        toast({ title: "Pool Refilled!", description: data.message, className: "bg-success text-success-foreground border-none" });
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
      },
      onError: (err: any) => toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" }),
    });
  };

  const handleRefillPlayer = () => {
    if (!selectedPlayer) { toast({ title: "No player selected", variant: "destructive" }); return; }
    const rawAmount = parseFloat(playerRefillAmount);
    if (isNaN(rawAmount) || rawAmount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    const amount = balanceMode === "subtract" ? -rawAmount : rawAmount;
    refillPlayerMut.mutate({ data: { userId: selectedPlayer.id, amount } }, {
      onSuccess: (data) => {
        const verb = balanceMode === "subtract" ? "Subtracted!" : "Added!";
        toast({ title: `Balance ${verb}`, description: data.message, className: "bg-success text-success-foreground border-none" });
        setSelectedPlayer((prev) => (prev ? { ...prev, balance: prev.balance + amount } : null));
        refetchPlayers();
      },
      onError: (err: any) => toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" }),
    });
  };

  const handleResetAllBalances = () => {
    const newBalance = parseFloat(resetBalanceAmount);
    if (isNaN(newBalance) || newBalance < 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    resetAllBalancesMut.mutate({ data: { newBalance } }, {
      onSuccess: (data) => {
        toast({ title: "Balances Reset!", description: data.message, className: "bg-success text-success-foreground border-none" });
        setConfirmReset(false);
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
        refetchPlayers();
      },
      onError: (err: any) => { toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" }); setConfirmReset(false); },
    });
  };

  const handleSeize = () => {
    if (!seizePlayers) { toast({ title: "Select a player", variant: "destructive" }); return; }
    const amount = parseFloat(seizeAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    if (seizeDestination === "user" && !seizeToUserId) { toast({ title: "Select destination user", variant: "destructive" }); return; }
    seizesMut.mutate({ data: { fromUserId: seizePlayers.id, amount, destination: seizeDestination, toUserId: seizeToUserId ?? undefined } }, {
      onSuccess: (data) => {
        toast({ title: "Assets Seized!", description: data.message, className: "bg-success text-success-foreground border-none" });
        setSeizePlayers(null); setSeizeAmount("10000");
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        refetchPlayers();
      },
      onError: (err: any) => toast({ title: "Seize Failed", description: err.error?.error || "Failed", variant: "destructive" }),
    });
  };

  const handleForceReload = async () => {
    setForceReloadPending(true);
    try {
      const res = await fetch(`${BASE}api/admin/force-reload`, { method: "POST", credentials: "include" });
      if (res.ok) {
        toast({ title: "Reload Signal Sent!", description: "All connected players will reload within 3 seconds.", className: "bg-success text-success-foreground border-none" });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed", variant: "destructive" });
      }
    } catch { toast({ title: "Error", description: "Network error", variant: "destructive" }); }
    finally { setForceReloadPending(false); }
  };

  const handleRemoveGuests = async () => {
    setRemoveGuestsPending(true);
    try {
      const res = await fetch(`${BASE}api/admin/guests`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Guests Removed!", description: data.message, className: "bg-success text-success-foreground border-none" });
        setConfirmRemoveGuests(false);
        refetchPlayers();
      } else {
        toast({ title: "Error", description: data.error || "Failed", variant: "destructive" });
      }
    } catch { toast({ title: "Error", description: "Network error", variant: "destructive" }); }
    finally { setRemoveGuestsPending(false); }
  };

  const handleUpdateSettings = () => {
    const usernameChangeCost = parseFloat(adminUsernameCost);
    const avatarChangeCost = parseFloat(adminAvatarCost);
    if (isNaN(usernameChangeCost) || isNaN(avatarChangeCost)) { toast({ title: "Invalid costs", variant: "destructive" }); return; }
    updateSettingsMut.mutate({ data: { usernameChangeCost, avatarChangeCost } }, {
      onSuccess: () => {
        toast({ title: "Settings Saved!", className: "bg-success text-success-foreground border-none" });
        refetchSettings();
      },
      onError: (err: any) => toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" }),
    });
  };

  const handleToggleGame = async (gameId: string) => {
    setTogglingGame(gameId);
    const isDisabled = disabledGames.includes(gameId);
    const newDisabled = isDisabled ? disabledGames.filter(g => g !== gameId) : [...disabledGames, gameId];
    updateSettingsMut.mutate({ data: { disabledGames: newDisabled } }, {
      onSuccess: (data) => {
        toast({ title: `${ALL_GAMES.find(g => g.id === gameId)?.name} ${!isDisabled ? "Disabled" : "Enabled"}`, className: isDisabled ? "bg-success text-success-foreground border-none" : "" });
        setDisabledGames(data.disabledGames ?? []);
        qc.invalidateQueries({ queryKey: ["/api/pool"] });
        setTogglingGame(null);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.error?.error || "Failed", variant: "destructive" });
        setTogglingGame(null);
      },
    });
  };

  const adminAction = async (url: string, method: string, body?: object) => {
    setActionLoading(true);
    try {
      const r = await fetch(`${BASE}api${url}`, {
        method, credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast({ title: "Done!", description: data.message, className: "bg-success text-success-foreground border-none" });
      setManagedAction(null);
      setManagedPlayer(null);
      setConfirmDelete(false);
      setBanReason("");
      refetchPlayers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const updateReportStatus = async (id: number, status: "reviewed" | "dismissed") => {
    try {
      await fetch(`${BASE}api/admin/reports/${id}/status`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch {}
  };

  const loadUserChats = async (userId: number, username: string) => {
    setChatsLoading(true);
    try {
      const r = await fetch(`${BASE}api/admin/user/${userId}/chats`, { credentials: "include" });
      const data = await r.json();
      setViewingChats({ userId, username, messages: data.messages ?? [] });
    } catch {} finally { setChatsLoading(false); }
  };

  const updateAppealStatus = async (id: number, status: "approved" | "denied") => {
    try {
      await fetch(`${BASE}api/admin/appeals/${id}/status`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setAppeals(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch {}
  };

  const handleCasinoSell = async (casinoId: number) => {
    setCasinoActionLoading(true);
    try {
      const r = await fetch(`${BASE}api/admin/casinos/${casinoId}/sell`, { method: "POST", credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast({ title: "Casino sold!", description: data.message, className: "bg-success text-success-foreground border-none" });
      setCasinoAction(null);
      loadAdminCasinos();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCasinoActionLoading(false); }
  };

  const handleCasinoDelete = async (casinoId: number) => {
    setCasinoActionLoading(true);
    try {
      const r = await fetch(`${BASE}api/admin/casinos/${casinoId}`, { method: "DELETE", credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast({ title: "Casino deleted!", description: data.message, className: "bg-success text-success-foreground border-none" });
      setCasinoAction(null);
      loadAdminCasinos();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCasinoActionLoading(false); }
  };

  const handleOwnerReset = async () => {
    setOwnerResetPending(true);
    try {
      const startingBalance = parseFloat(ownerStartingBalance) || 10000;
      const r = await fetch(`${BASE}api/admin/owner/reset`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startingBalance, ...ownerResetOptions }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast({ title: "Server Reset!", description: data.message, className: "bg-success text-success-foreground border-none" });
      setOwnerResetConfirm(false);
      qc.invalidateQueries({ queryKey: ["/api/pool"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      refetchPlayers();
      loadAdminCasinos();
    } catch (err: any) {
      toast({ title: "Reset Failed", description: err.message, variant: "destructive" });
    } finally { setOwnerResetPending(false); }
  };

  const pendingReports = reports.filter(r => r.status === "pending").length;
  const pendingMr = moneyRequests.filter(r => r.status === "pending").length;
  const pendingAppeals = appeals.filter(a => a.status === "pending").length;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 pt-4 pb-2">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-yellow-400">{isOwner ? "Owner Panel" : "Admin Panel"}</h1>
          <p className="text-sm text-muted-foreground">Manage games, economy, and players</p>
        </div>
        <div className="ml-auto">
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border">{user.username}</Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">All sections are collapsed by default. Click to expand.</p>

      {/* ── Game Controls ─────────────────────────────────────────────────────── */}
      <Card className="bg-black/60 border-yellow-500/20 overflow-hidden">
        <SectionHeader title="Game Controls" icon={<Gamepad2 className="w-5 h-5" />} accent="text-yellow-300" isOpen={isOpen("games")} onToggle={() => toggle("games")} />
        {isOpen("games") && (
          <CardContent className="px-6 pb-6 pt-2 border-t border-yellow-500/10 space-y-4">
            <p className="text-xs text-muted-foreground">Toggle games on or off. Disabled games show a maintenance overlay to players.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_GAMES.map((game) => {
                const isOff = disabledGames.includes(game.id);
                const isToggling = togglingGame === game.id;
                return (
                  <div key={game.id} className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-all ${isOff ? "bg-red-950/20 border-red-500/20" : "bg-emerald-950/20 border-emerald-500/20"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xl ${isOff ? "grayscale opacity-40" : ""}`}>{game.emoji}</span>
                      <div>
                        <p className={`text-sm font-medium ${isOff ? "text-muted-foreground" : "text-white"}`}>{game.name}</p>
                        <p className={`text-xs ${isOff ? "text-red-400" : "text-emerald-400"}`}>{isOff ? "Disabled" : "Live"}</p>
                      </div>
                    </div>
                    <button disabled={isToggling} onClick={() => handleToggleGame(game.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 ${isOff ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30" : "bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30"}`}>
                      {isToggling ? <RefreshCw className="w-3 h-3 animate-spin" /> : isOff ? <><Power className="w-3 h-3" /> Enable</> : <><PowerOff className="w-3 h-3" /> Disable</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Economy Controls ───────────────────────────────────────────────────── */}
      <Card className="bg-yellow-950/20 border-yellow-500/20 overflow-hidden">
        <SectionHeader title="Economy Controls" icon={<RefreshCw className="w-5 h-5" />} accent="text-yellow-300" isOpen={isOpen("economy")} onToggle={() => toggle("economy")} />
        {isOpen("economy") && (
          <CardContent className="px-6 pb-6 pt-2 border-t border-yellow-500/10 space-y-8">
            {/* Refill Pool */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-yellow-300 uppercase tracking-widest">Refill Global Pool</h3>
              <p className="text-xs text-muted-foreground">Current pool: <span className="text-primary font-mono">{formatCurrency(pool?.totalAmount ?? 0)}</span></p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" min="1" value={poolRefillAmount} onChange={e => setPoolRefillAmount(e.target.value)}
                    className="pl-7 bg-black/40 border-yellow-500/20 focus:border-yellow-500/50 font-mono" placeholder="Amount" />
                </div>
                <Button onClick={handleRefillPool} disabled={refillPoolMut.isPending} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
                  {refillPoolMut.isPending ? "Refilling..." : "Refill Pool"}
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[100000, 500000, 1000000, 5000000].map(amt => (
                  <button key={amt} onClick={() => setPoolRefillAmount(amt.toString())}
                    className="text-xs px-3 py-1 rounded-full border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                    ${(amt / 1000000).toFixed(1)}M
                  </button>
                ))}
              </div>
            </div>
            {/* Force Reload */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-orange-400 uppercase tracking-widest">Force Reload All Players</h3>
              <p className="text-xs text-muted-foreground">Sends a signal to every connected browser — they will all refresh within 3 seconds.</p>
              <Button onClick={handleForceReload} disabled={forceReloadPending} variant="outline"
                className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 gap-2">
                <RefreshCw className={`w-4 h-4 ${forceReloadPending ? "animate-spin" : ""}`} />
                {forceReloadPending ? "Sending Signal..." : "Reload Everyone's Browser"}
              </Button>
            </div>
            {/* Remove Guests */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-yellow-400 uppercase tracking-widest">Remove Guest Accounts</h3>
              <p className="text-xs text-muted-foreground">
                Immediately deletes all guest accounts. Guest accounts with no activity for 7 days are also removed automatically every 24 hours.
              </p>
              {!confirmRemoveGuests ? (
                <Button onClick={() => setConfirmRemoveGuests(true)} variant="outline"
                  className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300 gap-2">
                  <Trash2 className="w-4 h-4" />
                  Remove All Guests
                </Button>
              ) : (
                <div className="space-y-2 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                  <p className="text-xs text-yellow-300 font-medium">Are you sure? All guest accounts will be permanently deleted.</p>
                  <div className="flex gap-2">
                    <Button onClick={handleRemoveGuests} disabled={removeGuestsPending}
                      className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-2 flex-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      {removeGuestsPending ? "Removing..." : "Yes, Remove All"}
                    </Button>
                    <Button onClick={() => setConfirmRemoveGuests(false)} variant="outline"
                      className="border-white/20 text-muted-foreground flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {/* Seize Assets */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-purple-400 uppercase tracking-widest">Seize Player Assets</h3>
              <p className="text-xs text-muted-foreground">Take money from a player and send it to the pool or another account.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Seize from</label>
                  <select value={seizePlayers?.id ?? ""} onChange={e => {
                    const p = playersData?.players.find(pl => pl.id === parseInt(e.target.value));
                    setSeizePlayers(p ? { id: p.id, username: p.username } : null);
                  }} className="w-full bg-black/40 border border-purple-500/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500/50">
                    <option value="">— Select player —</option>
                    {playersData?.players.filter(p => !p.isAdmin).map(p => (
                      <option key={p.id} value={p.id}>{p.username} ({formatCurrency(p.balance)})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Amount to seize</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400">$</span>
                    <Input type="number" min="1" value={seizeAmount} onChange={e => setSeizeAmount(e.target.value)}
                      className="pl-7 bg-black/40 border-purple-500/20 font-mono focus:border-purple-500/50" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Send seized funds to</label>
                <div className="flex gap-2">
                  <button onClick={() => setSeizeDestination("pool")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${seizeDestination === "pool" ? "bg-purple-500/20 border-purple-500/60 text-purple-300" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}>
                    Global Pool
                  </button>
                  <button onClick={() => setSeizeDestination("user")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${seizeDestination === "user" ? "bg-purple-500/20 border-purple-500/60 text-purple-300" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}>
                    Another Player
                  </button>
                </div>
              </div>
              {seizeDestination === "user" && (
                <select value={seizeToUserId ?? ""} onChange={e => setSeizeToUserId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-black/40 border border-purple-500/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500/50">
                  <option value="">— Select destination —</option>
                  {playersData?.players.filter(p => p.id !== seizePlayers?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.username}</option>
                  ))}
                </select>
              )}
              <Button onClick={handleSeize} disabled={seizesMut.isPending || !seizePlayers || !parseFloat(seizeAmount)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2">
                <ShieldAlert className="w-4 h-4" />
                {seizesMut.isPending ? "Seizing..." : seizePlayers ? `Seize ${formatCurrency(parseFloat(seizeAmount) || 0)} from ${seizePlayers.username}` : "Seize Assets"}
              </Button>
            </div>
            {/* Reset All Balances */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-red-400 uppercase tracking-widest">Force Reset All Balances</h3>
              <p className="text-xs text-muted-foreground">Set every non-admin player's balance to a specific amount. This cannot be undone.</p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" min="0" value={resetBalanceAmount}
                    onChange={e => { setResetBalanceAmount(e.target.value); setConfirmReset(false); }}
                    className="pl-7 bg-black/40 border-red-500/20 focus:border-red-500/50 font-mono" placeholder="10000" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[0, 1000, 10000, 100000].map(amt => (
                    <button key={amt} onClick={() => { setResetBalanceAmount(amt.toString()); setConfirmReset(false); }}
                      className="text-xs px-3 py-1.5 rounded-full border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                      ${amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              {!confirmReset ? (
                <Button onClick={() => setConfirmReset(true)} variant="outline"
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                  Reset All Balances to {formatCurrency(parseFloat(resetBalanceAmount) || 0)}
                </Button>
              ) : (
                <div className="flex items-center gap-3 bg-red-950/30 border border-red-500/30 rounded-xl p-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-300">Are you sure?</p>
                    <p className="text-xs text-muted-foreground">This will reset ALL player balances to {formatCurrency(parseFloat(resetBalanceAmount) || 0)}.</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)} className="text-muted-foreground">Cancel</Button>
                  <Button size="sm" onClick={handleResetAllBalances} disabled={resetAllBalancesMut.isPending}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold">
                    {resetAllBalancesMut.isPending ? "Resetting..." : "Confirm Reset"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Player Balance Adjustment ─────────────────────────────────────────── */}
      <Card className="bg-yellow-950/20 border-yellow-500/20 overflow-hidden">
        <SectionHeader title="Adjust Player Balance" icon={<BanknoteIcon className="w-5 h-5" />} accent="text-yellow-300" isOpen={isOpen("balance")} onToggle={() => toggle("balance")} />
        {isOpen("balance") && (
          <CardContent className="px-6 pb-6 pt-2 border-t border-yellow-500/10 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-yellow-300 uppercase tracking-widest">Adjust Balance</h3>
                <div className="flex rounded-lg overflow-hidden border border-yellow-500/30 text-xs font-medium">
                  <button onClick={() => setBalanceMode("add")}
                    className={`px-3 py-1.5 transition-colors ${balanceMode === "add" ? "bg-yellow-500 text-black" : "bg-black/40 text-yellow-400 hover:bg-yellow-500/10"}`}>
                    + Add
                  </button>
                  <button onClick={() => setBalanceMode("subtract")}
                    className={`px-3 py-1.5 transition-colors ${balanceMode === "subtract" ? "bg-red-500 text-white" : "bg-black/40 text-red-400 hover:bg-red-500/10"}`}>
                    − Subtract
                  </button>
                </div>
              </div>
              {selectedPlayer ? (
                <div className="bg-black/40 border border-yellow-500/30 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500/40 to-yellow-700/40 border border-yellow-500/30 flex items-center justify-center font-bold text-yellow-300 text-sm">
                        {selectedPlayer.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{selectedPlayer.username}</p>
                        <p className="text-xs text-muted-foreground">ID #{selectedPlayer.id}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPlayer(null)} className="text-muted-foreground hover:text-white p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold ${balanceMode === "subtract" ? "text-red-400" : "text-yellow-400"}`}>$</span>
                      <Input type="number" min="1" value={playerRefillAmount} onChange={e => setPlayerRefillAmount(e.target.value)}
                        className={`pl-7 bg-black/60 font-mono text-lg h-11 ${balanceMode === "subtract" ? "border-red-500/30 focus:border-red-500/60" : "border-yellow-500/30 focus:border-yellow-500/60"}`} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[1000, 10000, 50000, 100000].map(amt => (
                        <button key={amt} onClick={() => setPlayerRefillAmount(amt.toString())}
                          className={`text-xs px-3 py-1 rounded-full border transition-colors ${playerRefillAmount === amt.toString()
                            ? balanceMode === "subtract" ? "bg-red-500/20 border-red-500/60 text-red-300" : "bg-yellow-500/20 border-yellow-500/60 text-yellow-300"
                            : balanceMode === "subtract" ? "border-red-500/20 text-red-500 hover:bg-red-500/10" : "border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10"
                          }`}>
                          {balanceMode === "subtract" ? "-" : "+"}${amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="flex-1 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Current</p>
                      <p className="font-mono font-bold text-white">{formatCurrency(selectedPlayer.balance)}</p>
                    </div>
                    <div className={balanceMode === "subtract" ? "text-red-400" : "text-yellow-500"}>
                      {balanceMode === "subtract" ? <span className="font-bold text-lg">−</span> : <Plus className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{balanceMode === "subtract" ? "Subtracting" : "Adding"}</p>
                      <p className={`font-mono font-bold ${balanceMode === "subtract" ? "text-red-400" : "text-yellow-400"}`}>
                        {balanceMode === "subtract" ? "-" : "+"}{formatCurrency(parseFloat(playerRefillAmount) || 0)}
                      </p>
                    </div>
                    <div className="text-muted-foreground"><ArrowRight className="w-4 h-4" /></div>
                    <div className="flex-1 text-center">
                      <p className="text-xs text-muted-foreground mb-1">New Balance</p>
                      <p className={`font-mono font-bold ${(refillPreviewBalance || 0) < 0 ? "text-destructive" : "text-primary"}`}>
                        {formatCurrency(Math.max(0, refillPreviewBalance || 0))}
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleRefillPlayer} disabled={refillPlayerMut.isPending || !parseFloat(playerRefillAmount)}
                    className={`w-full font-bold h-11 ${balanceMode === "subtract" ? "bg-red-600 hover:bg-red-500 text-white" : "bg-yellow-500 hover:bg-yellow-400 text-black"}`}>
                    {refillPlayerMut.isPending ? "Processing..." : balanceMode === "subtract"
                      ? `Subtract ${formatCurrency(parseFloat(playerRefillAmount) || 0)} from ${selectedPlayer.username}`
                      : `Add ${formatCurrency(parseFloat(playerRefillAmount) || 0)} to ${selectedPlayer.username}`}
                  </Button>
                </div>
              ) : (
                <div className="border border-dashed border-yellow-500/20 rounded-xl p-6 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 text-yellow-500/30" />
                  <p className="text-sm">Click <span className="text-yellow-400 font-medium">Select</span> on any player below.</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-yellow-300 uppercase tracking-widest">All Players</h3>
                <Button variant="ghost" size="sm" onClick={() => refetchPlayers()} className="text-yellow-400 hover:text-yellow-300">
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                </Button>
              </div>
              <div className="rounded-xl overflow-hidden border border-yellow-500/10">
                <table className="w-full text-sm">
                  <thead className="bg-yellow-950/40 text-yellow-400 text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">ID</th>
                      <th className="px-4 py-3 text-left">Username</th>
                      <th className="px-4 py-3 text-left">Balance</th>
                      <th className="px-4 py-3 text-left">Games</th>
                      <th className="px-4 py-3 text-left">W/L</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-yellow-500/5">
                    {playersLoading ? (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading players...</td></tr>
                    ) : playersData?.players.map(player => {
                      const isSelected = selectedPlayer?.id === player.id;
                      return (
                        <tr key={player.id} onClick={() => setSelectedPlayer(isSelected ? null : player)}
                          className={`transition-colors cursor-pointer ${isSelected ? "bg-yellow-950/40 border-l-2 border-yellow-500" : "hover:bg-yellow-950/20"}`}>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{player.id}</td>
                          <td className="px-4 py-3 font-medium">
                            <span className="flex items-center gap-1">
                              {player.username}
                              <PlayerStatusIcons player={player} />
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-primary">{formatCurrency(player.balance)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{player.gamesPlayed}</td>
                          <td className="px-4 py-3 text-muted-foreground">{player.totalWins}W / {player.totalLosses}L</td>
                          <td className="px-4 py-3">
                            {player.isAdmin
                              ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs">Admin</Badge>
                              : <Badge variant="outline" className="text-xs text-muted-foreground">Player</Badge>}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={e => { e.stopPropagation(); setSelectedPlayer(isSelected ? null : player); }}
                              className={`text-xs font-medium px-2 py-1 rounded ${isSelected ? "bg-yellow-500/20 text-yellow-300" : "text-yellow-400 hover:bg-yellow-500/10"}`}>
                              {isSelected ? "Selected ✓" : "Select"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── User Management ───────────────────────────────────────────────────── */}
      <Card className="bg-red-950/10 border-red-500/20 overflow-hidden">
        <SectionHeader title="User Management" icon={<UserX className="w-5 h-5" />} accent="text-red-300" isOpen={isOpen("users")} onToggle={() => toggle("users")} />
        {isOpen("users") && (
          <CardContent className="px-6 pb-6 pt-2 border-t border-red-500/10 space-y-4">
            <p className="text-xs text-muted-foreground">Manage player accounts. Changes are immediate and irreversible.</p>
            {managedPlayer && (
              <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center font-bold text-red-300 text-sm">
                      {managedPlayer.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{managedPlayer.username}</p>
                      <p className="text-xs text-muted-foreground">ID #{managedPlayer.id}</p>
                    </div>
                  </div>
                  <button onClick={() => { setManagedPlayer(null); setManagedAction(null); setConfirmDelete(false); }} className="text-muted-foreground hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "username", label: "Change Username", icon: <Edit2 className="w-3.5 h-3.5" /> },
                    { key: "avatar", label: "Change Avatar", icon: <Link2 className="w-3.5 h-3.5" /> },
                    { key: "suspend", label: "Suspend", icon: <Clock className="w-3.5 h-3.5" /> },
                    { key: "ban", label: "Temp Ban", icon: <UserX className="w-3.5 h-3.5" /> },
                    { key: "perma", label: "Perma-Ban", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                    { key: "unban", label: "Lift Ban", icon: <UserCheck className="w-3.5 h-3.5" /> },
                    { key: "promote", label: "Promote to Admin", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
                    { key: "delete", label: "Delete Account", icon: <Trash2 className="w-3.5 h-3.5" /> },
                  ].map(action => (
                    <button key={action.key} onClick={() => { setManagedAction(managedAction === action.key ? null : action.key); setConfirmDelete(false); }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                        managedAction === action.key
                          ? action.key === "delete" || action.key === "perma" ? "bg-red-500/30 border-red-500/60 text-red-200"
                            : action.key === "promote" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                            : "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                          : action.key === "delete" || action.key === "perma" ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                            : action.key === "promote" ? "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                            : "border-white/10 text-muted-foreground hover:text-white hover:bg-white/5"
                      }`}>
                      {action.icon} {action.label}
                    </button>
                  ))}
                </div>

                {managedAction === "username" && (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">New Username</label>
                    <div className="flex gap-2">
                      <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Enter new username"
                        className="bg-black/40 border-white/10 focus:border-yellow-500/50" />
                      <Button onClick={() => adminAction(`/admin/user/${managedPlayer.id}/change-username`, "POST", { newUsername })} disabled={!newUsername.trim() || actionLoading}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold whitespace-nowrap">
                        {actionLoading ? "Saving..." : "Change"}
                      </Button>
                    </div>
                  </div>
                )}
                {managedAction === "avatar" && (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">New Avatar URL (leave blank to remove)</label>
                    <div className="flex gap-2">
                      <Input value={newAvatarUrl} onChange={e => setNewAvatarUrl(e.target.value)} placeholder="https://..."
                        className="bg-black/40 border-white/10 focus:border-yellow-500/50" />
                      <Button onClick={() => adminAction(`/admin/user/${managedPlayer.id}/change-avatar`, "POST", { avatarUrl: newAvatarUrl || null })} disabled={actionLoading}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold whitespace-nowrap">
                        {actionLoading ? "Saving..." : newAvatarUrl ? "Set Avatar" : "Remove Avatar"}
                      </Button>
                    </div>
                  </div>
                )}
                {managedAction === "suspend" && (
                  <div className="space-y-3">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Suspend for how many hours?</label>
                    <div className="flex gap-2 flex-wrap">
                      {["1", "6", "24", "72", "168"].map(h => (
                        <button key={h} onClick={() => setSuspendHours(h)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${suspendHours === h ? "bg-orange-500/20 border-orange-500/60 text-orange-300" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}>
                          {h}h
                        </button>
                      ))}
                      <input type="number" min="1" value={suspendHours} onChange={e => setSuspendHours(e.target.value)}
                        className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-orange-500/50" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Reason (shown to player)</label>
                      <input type="text" value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Optional reason..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500/50" />
                    </div>
                    <Button onClick={() => adminAction(`/admin/user/${managedPlayer.id}/suspend`, "POST", { hours: parseFloat(suspendHours), reason: banReason || undefined })} disabled={actionLoading}
                      className="bg-orange-600 hover:bg-orange-500 text-white font-bold">
                      {actionLoading ? "Suspending..." : `Suspend ${managedPlayer.username} for ${suspendHours}h`}
                    </Button>
                  </div>
                )}
                {managedAction === "ban" && (
                  <div className="space-y-3">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Ban for how many hours?</label>
                    <div className="flex gap-2 flex-wrap">
                      {["24", "72", "168", "720", "2160"].map(h => (
                        <button key={h} onClick={() => setBanHours(h)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${banHours === h ? "bg-red-500/20 border-red-500/60 text-red-300" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}>
                          {h === "168" ? "1 week" : h === "720" ? "30 days" : h === "2160" ? "90 days" : `${h}h`}
                        </button>
                      ))}
                      <input type="number" min="1" value={banHours} onChange={e => setBanHours(e.target.value)}
                        className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Reason (shown to player)</label>
                      <input type="text" value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Optional reason..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-red-500/50" />
                    </div>
                    <Button onClick={() => adminAction(`/admin/user/${managedPlayer.id}/ban`, "POST", { hours: parseFloat(banHours), reason: banReason || undefined })} disabled={actionLoading}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold">
                      {actionLoading ? "Banning..." : `Ban ${managedPlayer.username} for ${banHours}h`}
                    </Button>
                  </div>
                )}
                {managedAction === "perma" && (
                  <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-red-300 font-semibold">Permanently ban {managedPlayer.username}?</p>
                    <p className="text-xs text-muted-foreground">This will permanently block the account. It can only be undone by an admin lifting the ban.</p>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Reason (shown to player)</label>
                      <input type="text" value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Optional reason..."
                        className="w-full bg-black/40 border border-red-500/20 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-red-500/50" />
                    </div>
                    <Button onClick={() => adminAction(`/admin/user/${managedPlayer.id}/perma-ban`, "POST", { reason: banReason || undefined })} disabled={actionLoading}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold">
                      {actionLoading ? "Banning..." : "Permanently Ban Account"}
                    </Button>
                  </div>
                )}
                {managedAction === "unban" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">This will remove all active suspensions and bans from {managedPlayer.username}.</p>
                    <Button onClick={() => adminAction(`/admin/user/${managedPlayer.id}/unban`, "POST")} disabled={actionLoading}
                      className="bg-green-600 hover:bg-green-500 text-white font-bold">
                      {actionLoading ? "Lifting..." : `Lift All Bans from ${managedPlayer.username}`}
                    </Button>
                  </div>
                )}
                {managedAction === "promote" && (
                  <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-emerald-300 font-semibold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Promote {managedPlayer.username} to Admin?
                    </p>
                    <p className="text-xs text-muted-foreground">This grants full admin privileges: game controls, player management, economy tools, and broadcast. This cannot be undone from the panel once confirmed.</p>
                    <Button onClick={() => adminAction(`/admin/user/${managedPlayer.id}/promote`, "POST")} disabled={actionLoading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                      {actionLoading ? "Promoting..." : `Yes, Promote ${managedPlayer.username} to Admin`}
                    </Button>
                  </div>
                )}
                {managedAction === "delete" && (
                  <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4 space-y-3">
                    {!confirmDelete ? (
                      <>
                        <p className="text-sm text-red-300 font-semibold">Delete account: {managedPlayer.username}?</p>
                        <p className="text-xs text-muted-foreground">This permanently deletes all player data, bets, chat history, and funds. This cannot be undone.</p>
                        <Button onClick={() => setConfirmDelete(true)} variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10">
                          I understand — show confirmation
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-red-300 font-bold">Are you absolutely sure?</p>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="text-muted-foreground">Cancel</Button>
                          <Button size="sm" onClick={() => adminAction(`/admin/user/${managedPlayer.id}`, "DELETE")} disabled={actionLoading}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold">
                            {actionLoading ? "Deleting..." : "Yes, Delete Forever"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl overflow-hidden border border-red-500/10">
              <table className="w-full text-sm">
                <thead className="bg-red-950/30 text-red-400 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Username</th>
                    <th className="px-4 py-3 text-left">Balance</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-500/5">
                  {playersLoading ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading players...</td></tr>
                  ) : playersData?.players.map(player => {
                    const isManaged = managedPlayer?.id === player.id;
                    return (
                      <tr key={player.id} className={`transition-colors ${isManaged ? "bg-red-950/30" : "hover:bg-red-950/10"}`}>
                        <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{player.id}</td>
                        <td className="px-4 py-3 font-medium">
                          <span className="flex items-center gap-1">
                            <Link href={`/player/${encodeURIComponent(player.username)}`} className="hover:text-primary hover:underline">{player.username}</Link>
                            <PlayerStatusIcons player={player} />
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-primary text-xs">{formatCurrency(player.balance)}</td>
                        <td className="px-4 py-3">
                          {player.isAdmin
                            ? <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs">Admin</Badge>
                            : <Badge variant="outline" className="text-xs text-muted-foreground">Player</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          {!player.isAdmin && (
                            <button onClick={() => { setManagedPlayer(isManaged ? null : player); setManagedAction(null); setConfirmDelete(false); }}
                              className={`text-xs font-medium px-2 py-1 rounded transition-colors ${isManaged ? "bg-red-500/20 text-red-300" : "text-red-400 hover:bg-red-500/10"}`}>
                              {isManaged ? "Managing ✓" : "Manage"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Reports ───────────────────────────────────────────────────────────── */}
      <Card className="bg-orange-950/10 border-orange-500/20 overflow-hidden">
        <SectionHeader
          title="Player Reports"
          icon={<Flag className="w-5 h-5" />}
          badge={pendingReports > 0 ? <Badge className="bg-orange-500 text-black font-bold ml-1">{pendingReports}</Badge> : undefined}
          accent="text-orange-300"
          isOpen={isOpen("reports")}
          onToggle={() => { const wasOpen = isOpen("reports"); toggle("reports"); if (!wasOpen) loadReports(); }}
        />
        {isOpen("reports") && (
          <CardContent className="px-6 pb-6 pt-2 border-t border-orange-500/10 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Reports submitted by players against other players.</p>
              <Button variant="ghost" size="sm" onClick={loadReports} disabled={reportsLoading} className="text-orange-400 hover:text-orange-300">
                <RefreshCw className={`w-3 h-3 mr-1 ${reportsLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>

            {viewingChats && (
              <div className="bg-black/60 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Chat history: {viewingChats.username}</h3>
                  <button onClick={() => setViewingChats(null)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                {chatsLoading ? (
                  <div className="text-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
                ) : viewingChats.messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No messages found.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {viewingChats.messages.map((m: any) => (
                      <div key={m.id} className="text-xs bg-black/40 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">[{m.room_name}]</span>{" "}
                        <span className="text-white">{m.content}</span>{" "}
                        <span className="text-muted-foreground/60">{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {reports.length === 0 && !reportsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Flag className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No reports yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map(report => (
                  <div key={report.id} className={`rounded-xl border p-4 space-y-2 ${report.status === "pending" ? "bg-orange-950/20 border-orange-500/20" : "bg-black/20 border-white/5 opacity-60"}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{report.reportedUsername}</span>
                        <span className="text-xs text-muted-foreground">reported by {report.reporterUsername ?? "Anonymous"}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${report.status === "pending" ? "bg-orange-500/20 text-orange-400 border-orange-500/30 border" : report.status === "reviewed" ? "bg-green-500/10 text-green-400 border-green-500/20 border" : "bg-white/5 text-muted-foreground border-white/10 border"}`}>
                          {report.status}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs"><span className="text-orange-400 font-medium">Reason:</span> {report.reason}</p>
                    {report.details && <p className="text-xs text-muted-foreground italic">"{report.details}"</p>}
                    {report.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="ghost" onClick={() => loadUserChats(report.reportedUserId, report.reportedUsername)}
                          className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 gap-1">
                          <Eye className="w-3 h-3" /> View Chats
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "reviewed")}
                          className="text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Mark Reviewed
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateReportStatus(report.id, "dismissed")}
                          className="text-xs text-muted-foreground hover:text-white h-7 gap-1">
                          <XCircle className="w-3 h-3" /> Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Broadcast ─────────────────────────────────────────────────────────── */}
      <Card className="bg-purple-950/20 border-purple-500/20 overflow-hidden">
        <SectionHeader title="Admin Broadcast" icon={<Megaphone className="w-5 h-5" />} accent="text-purple-300" isOpen={isOpen("broadcast")} onToggle={() => toggle("broadcast")} />
        {isOpen("broadcast") && (
          <CardContent className="px-6 pb-6 pt-2 border-t border-purple-500/10 space-y-3">
            <p className="text-xs text-muted-foreground">Send a highlighted announcement to the General chat room. It appears as a golden banner visible to all players.</p>
            <div className="flex gap-2">
              <Input value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Type your announcement..."
                maxLength={300} className="flex-1 bg-black/40 border-purple-500/20 focus:border-purple-400/50"
                onKeyDown={e => e.key === "Enter" && !broadcastPending && sendBroadcast()} />
              <Button onClick={sendBroadcast} disabled={!broadcastMsg.trim() || broadcastPending}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2 whitespace-nowrap">
                <Megaphone className="w-4 h-4" />
                {broadcastPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Ban Appeals ────────────────────────────────────────────────────────── */}
      <Card className="bg-purple-950/20 border-purple-500/20 overflow-hidden">
        <SectionHeader
          title="Ban Appeals"
          icon={<AlertTriangle className="w-5 h-5" />}
          badge={pendingAppeals > 0 ? <Badge className="bg-purple-500 text-white font-bold ml-1">{pendingAppeals} pending</Badge> : undefined}
          accent="text-purple-300"
          isOpen={isOpen("appeals")}
          onToggle={() => { const wasOpen = isOpen("appeals"); toggle("appeals"); if (!wasOpen) loadAppeals(); }}
        />
        {isOpen("appeals") && (
          <CardContent className="p-0 border-t border-purple-500/10">
            <div className="flex justify-end px-4 py-2">
              <Button variant="ghost" size="sm" onClick={loadAppeals} disabled={appealsLoading} className="text-purple-400 hover:text-purple-300">
                <RefreshCw className={`w-3 h-3 mr-1 ${appealsLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            {appealsLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading appeals...</div>
            ) : appeals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No ban appeals yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-purple-500/10">
                {appeals.map(appeal => (
                  <div key={appeal.id} className={`p-4 space-y-3 ${appeal.status === "pending" ? "bg-purple-950/20" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/player/${encodeURIComponent(appeal.username ?? "")}`} className="font-semibold text-sm hover:text-primary hover:underline">
                          {appeal.username ?? "Unknown"}
                        </Link>
                        {appeal.permanentlyBanned && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-[10px]">Perma-Banned</Badge>}
                        {!appeal.permanentlyBanned && appeal.bannedUntil && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 border text-[10px]">Temp Banned</Badge>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          appeal.status === "pending" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" :
                          appeal.status === "approved" ? "bg-green-500/10 border-green-500/30 text-green-400" :
                          "bg-white/5 border-white/10 text-muted-foreground"
                        }`}>
                          {appeal.status === "pending" ? "Pending Review" : appeal.status === "approved" ? "Approved" : "Denied"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{new Date(appeal.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="bg-black/30 rounded-lg px-3 py-2 border border-white/5 text-sm text-muted-foreground italic">
                      "{appeal.message}"
                    </div>
                    {appeal.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => updateAppealStatus(appeal.id, "approved")}
                          className="text-green-400 hover:text-green-300 hover:bg-green-500/10 gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" /> Approve &amp; Unban
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateAppealStatus(appeal.id, "denied")}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5">
                          <XCircle className="w-3.5 h-3.5" /> Deny
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Money Requests ───────────────────────────────────────────────────── */}
      <Card className="bg-green-950/20 border-green-500/20 overflow-hidden">
        <SectionHeader
          title="Money Requests"
          icon={<BanknoteIcon className="w-5 h-5" />}
          badge={pendingMr > 0 ? <Badge className="bg-green-500 text-black font-bold ml-1">{pendingMr} pending</Badge> : undefined}
          accent="text-green-300"
          isOpen={isOpen("money")}
          onToggle={() => toggle("money")}
        />
        {isOpen("money") && (
          <CardContent className="p-0 border-t border-green-500/10">
            <div className="flex justify-end px-4 py-2">
              <Button variant="ghost" size="sm" onClick={loadMoneyRequests} className="text-muted-foreground hover:text-green-300">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
            </div>
            {moneyRequests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <BanknoteIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No money requests yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {moneyRequests.map(req => (
                  <MoneyRequestRow key={req.id} req={req} onFulfill={fulfillRequest} onDismiss={dismissRequest} loading={mrLoading} />
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Casino Management ─────────────────────────────────────────────────── */}
      <Card className="bg-blue-950/20 border-blue-500/20 overflow-hidden">
        <SectionHeader
          title="Casino Management"
          icon={<Building2 className="w-5 h-5" />}
          badge={adminCasinos.length > 0 ? <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 border ml-1">{adminCasinos.length}</Badge> : undefined}
          accent="text-blue-300"
          isOpen={isOpen("casinoMgmt")}
          onToggle={() => { toggle("casinoMgmt"); if (!isOpen("casinoMgmt")) loadAdminCasinos(); }}
        />
        {isOpen("casinoMgmt") && (
          <CardContent className="px-6 pb-6 pt-2 border-t border-blue-500/10 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Sell (10% refund to owner) or force-delete player casinos.</p>
              <Button variant="ghost" size="sm" onClick={loadAdminCasinos} disabled={casinosLoading} className="text-muted-foreground hover:text-blue-300 text-xs gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${casinosLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            {adminCasinos.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No player casinos found.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {adminCasinos.map((casino: any) => (
                  <div key={casino.id} className="rounded-xl border border-white/5 bg-card/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{casino.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{casino.name}</p>
                          <p className="text-xs text-muted-foreground">
                            by <span className="text-white/70">{casino.ownerUsername ?? "Unknown"}</span> · {formatCurrency(parseFloat(casino.bankroll ?? "0"))} bankroll
                            {casino.insolvencyWinnerId && <span className="text-red-400 ml-1">⚠ Insolvent</span>}
                            {casino.isPaused && <span className="text-yellow-400 ml-1">⏸ Paused</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {casinoAction?.id === casino.id ? (
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-white/50">{casinoAction.type === "sell" ? "Sell for 10% refund?" : "Delete with no refund?"}</p>
                            <Button size="sm" className={`h-7 px-3 text-xs ${casinoAction.type === "sell" ? "bg-blue-700 hover:bg-blue-600" : "bg-red-700 hover:bg-red-600"}`}
                              disabled={casinoActionLoading}
                              onClick={() => casinoAction.type === "sell" ? handleCasinoSell(casino.id) : handleCasinoDelete(casino.id)}>
                              {casinoActionLoading ? "..." : "Confirm"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setCasinoAction(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-blue-500/30 text-blue-300 hover:bg-blue-900/30"
                              onClick={() => setCasinoAction({ id: casino.id, type: "sell" })}>
                              Sell
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-red-500/30 text-red-300 hover:bg-red-900/30"
                              onClick={() => setCasinoAction({ id: casino.id, type: "delete" })}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Owner Panel (owner only) ───────────────────────────────────────────── */}
      {isOwner && (
        <Card className="bg-red-950/20 border-red-500/30 overflow-hidden">
          <SectionHeader title="Owner Controls" icon={<ShieldCheck className="w-5 h-5" />} accent="text-red-300" isOpen={isOpen("owner")} onToggle={() => toggle("owner")} />
          {isOpen("owner") && (
            <CardContent className="px-6 pb-6 pt-2 border-t border-red-500/20 space-y-6">
              <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-4 space-y-4">
                <h3 className="text-sm font-bold text-red-300 uppercase tracking-widest">⚠ Full Server Reset</h3>
                <p className="text-xs text-red-200/70">This will reset player balances, and optionally wipe the pool, all casinos, and all gameplay stats. This cannot be undone.</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground w-40">Starting balance per player:</label>
                    <div className="relative flex-1 max-w-xs">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" min="0" value={ownerStartingBalance} onChange={e => setOwnerStartingBalance(e.target.value)}
                        className="pl-7 bg-black/40 border-red-500/20 focus:border-red-500/50 font-mono h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {(["resetPool", "deleteCasinos", "deleteStats"] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                        <input type="checkbox" checked={ownerResetOptions[opt]}
                          onChange={e => setOwnerResetOptions(prev => ({ ...prev, [opt]: e.target.checked }))}
                          className="accent-red-500" />
                        {opt === "resetPool" ? "Reset global pool" : opt === "deleteCasinos" ? "Delete all casinos" : "Delete all stats & bets"}
                      </label>
                    ))}
                  </div>
                  {!ownerResetConfirm ? (
                    <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-900/30 w-full" onClick={() => setOwnerResetConfirm(true)}>
                      Reset Server…
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-red-300 text-center font-bold">Are you sure? This will affect all players.</p>
                      <div className="flex gap-3">
                        <Button className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold" disabled={ownerResetPending}
                          onClick={handleOwnerReset}>
                          {ownerResetPending ? "Resetting..." : "Yes, Reset Everything"}
                        </Button>
                        <Button variant="ghost" className="flex-1" onClick={() => setOwnerResetConfirm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Settings ──────────────────────────────────────────────────────────── */}
      <Card className="bg-yellow-950/20 border-yellow-500/20 overflow-hidden">
        <SectionHeader title="Settings" icon={<Settings className="w-5 h-5" />} accent="text-yellow-300" isOpen={isOpen("settings")} onToggle={() => toggle("settings")} />
        {isOpen("settings") && (
          <CardContent className="px-6 pb-6 pt-2 border-t border-yellow-500/10 space-y-4">
            <p className="text-xs text-muted-foreground">Set what players pay to customize their profile.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-yellow-400 uppercase tracking-wider">Username Change Cost</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" min="0" value={adminUsernameCost} onChange={e => setAdminUsernameCost(e.target.value)}
                    className="pl-7 bg-black/40 border-yellow-500/20 focus:border-yellow-500/50 font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-yellow-400 uppercase tracking-wider">Avatar Change Cost</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" min="0" value={adminAvatarCost} onChange={e => setAdminAvatarCost(e.target.value)}
                    className="pl-7 bg-black/40 border-yellow-500/20 focus:border-yellow-500/50 font-mono" />
                </div>
              </div>
            </div>
            <Button onClick={handleUpdateSettings} disabled={updateSettingsMut.isPending}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
              {updateSettingsMut.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
