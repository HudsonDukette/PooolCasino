import React, { useState, useEffect, useMemo } from "react";
import {
  useGetMe,
  useGetUserStats,
  useGetTransactions,
  useClaimDailyReward,
  useAdminRefillPool,
  useAdminRefillPlayer,
  useAdminListPlayers,
  useAdminResetAllBalances,
  useAdminSeize,
  useTransfer,
  useChangeUsername,
  useChangeAvatar,
  useGetProfileChangeCosts,
  useAdminGetSettings,
  useAdminUpdateSettings,
} from "@workspace/api-client-react";
import type { AdminPlayer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Trophy, Gift, ArrowUpRight, Coins, History, Calendar, Target, Flame,
  ShieldAlert, RefreshCw, Users, X, ArrowRight, Plus, Copy, Check,
  Edit2, Image, Tag, Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Profile() {
  const { data: user, isLoading: userLoading } = useGetMe({ query: { retry: false } });
  const { data: stats, isLoading: statsLoading } = useGetUserStats({ query: { enabled: !!user } });
  const [page, setPage] = useState(0);
  const limit = 10;
  const { data: txData, isLoading: txLoading } = useGetTransactions(
    { offset: page * limit, limit },
    { query: { enabled: !!user, keepPreviousData: true } }
  );

  const claimMut = useClaimDailyReward();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [poolRefillAmount, setPoolRefillAmount] = useState("1000000");
  const [selectedPlayer, setSelectedPlayer] = useState<AdminPlayer | null>(null);
  const [playerRefillAmount, setPlayerRefillAmount] = useState("10000");
  const [balanceMode, setBalanceMode] = useState<"add" | "subtract">("add");
  const [resetBalanceAmount, setResetBalanceAmount] = useState("10000");
  const [confirmReset, setConfirmReset] = useState(false);
  const [forceReloadPending, setForceReloadPending] = useState(false);

  const [transferToUsername, setTransferToUsername] = useState("");
  const [transferAmount, setTransferAmount] = useState("100");

  const [seizePlayers, setSeizePlayers] = useState<{ id: number; username: string } | null>(null);
  const [seizeAmount, setSeizeAmount] = useState("10000");
  const [seizeDestination, setSeizeDestination] = useState<"pool" | "user">("pool");
  const [seizeToUserId, setSeizeToUserId] = useState<number | null>(null);

  const refillPoolMut = useAdminRefillPool();
  const refillPlayerMut = useAdminRefillPlayer();
  const resetAllBalancesMut = useAdminResetAllBalances();
  const transferMut = useTransfer();
  const seizesMut = useAdminSeize();
  const { data: playersData, isLoading: playersLoading, refetch: refetchPlayers } = useAdminListPlayers({
    query: { enabled: !!user?.isAdmin },
  });

  const { data: costs } = useGetProfileChangeCosts({ query: { enabled: !!user } });
  const { data: adminSettings, refetch: refetchSettings } = useAdminGetSettings({ query: { enabled: !!user?.isAdmin } });
  const changeUsernameMut = useChangeUsername();
  const changeAvatarMut = useChangeAvatar();
  const updateSettingsMut = useAdminUpdateSettings();

  const [newUsername, setNewUsername] = useState("");
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [showAvatarForm, setShowAvatarForm] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [adminUsernameCost, setAdminUsernameCost] = useState("");
  const [adminAvatarCost, setAdminAvatarCost] = useState("");

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { canClaim, countdownLabel } = useMemo(() => {
    const lastClaim = stats?.lastDailyClaim ? new Date(stats.lastDailyClaim) : null;
    if (!lastClaim) return { canClaim: true, countdownLabel: null };
    const todayUTC = now.toISOString().slice(0, 10);
    const lastClaimUTC = lastClaim.toISOString().slice(0, 10);
    if (todayUTC !== lastClaimUTC) return { canClaim: true, countdownLabel: null };
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const msLeft = midnight.getTime() - now.getTime();
    const h = Math.floor(msLeft / (1000 * 60 * 60));
    const m = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return { canClaim: false, countdownLabel: label };
  }, [stats?.lastDailyClaim, now]);

  const adjustedAmount = balanceMode === "subtract"
    ? -(parseFloat(playerRefillAmount) || 0)
    : (parseFloat(playerRefillAmount) || 0);
  const refillPreviewBalance = selectedPlayer
    ? selectedPlayer.balance + adjustedAmount
    : null;

  React.useEffect(() => {
    if (adminSettings) {
      setAdminUsernameCost(adminSettings.usernameChangeCost.toString());
      setAdminAvatarCost(adminSettings.avatarChangeCost.toString());
    }
  }, [adminSettings]);

  if (!user && !userLoading) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Please log in to view your profile</h2>
        <Button onClick={() => (window.location.href = "/login")}>Go to Login</Button>
      </div>
    );
  }

  const handleClaim = () => {
    claimMut.mutate(undefined, {
      onSuccess: (data) => {
        toast({ title: "Claimed!", description: data.message, className: "bg-success text-success-foreground border-none" });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      },
      onError: (err) => {
        toast({ title: "Claim Failed", description: err.error?.error || "Cannot claim right now", variant: "destructive" });
      },
    });
  };

  const handleCopyReferral = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    }
  };

  const compressImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const maxSize = 200;
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAvatarFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please drop an image file.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await compressImageFile(file);
      changeAvatarMut.mutate(
        { data: { avatarUrl: dataUrl } },
        {
          onSuccess: (data) => {
            toast({ title: "Avatar Updated!", description: data.message, className: "bg-success text-success-foreground border-none" });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          },
          onError: (err) => {
            toast({ title: "Failed", description: err.error?.error || "Could not update avatar", variant: "destructive" });
          },
        }
      );
    } catch {
      toast({ title: "Error", description: "Could not process image.", variant: "destructive" });
    }
  };

  const handleChangeUsername = () => {
    if (!newUsername.trim()) return;
    changeUsernameMut.mutate(
      { data: { newUsername: newUsername.trim() } },
      {
        onSuccess: (data) => {
          toast({ title: "Username Changed!", description: data.message, className: "bg-success text-success-foreground border-none" });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
          setShowUsernameForm(false);
          setNewUsername("");
        },
        onError: (err) => {
          toast({ title: "Failed", description: err.error?.error || "Could not change username", variant: "destructive" });
        },
      }
    );
  };

  const handleChangeAvatar = () => {
    if (!newAvatarUrl.trim()) return;
    changeAvatarMut.mutate(
      { data: { avatarUrl: newAvatarUrl.trim() } },
      {
        onSuccess: (data) => {
          toast({ title: "Avatar Updated!", description: data.message, className: "bg-success text-success-foreground border-none" });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
          setShowAvatarForm(false);
          setNewAvatarUrl("");
        },
        onError: (err) => {
          toast({ title: "Failed", description: err.error?.error || "Could not update avatar", variant: "destructive" });
        },
      }
    );
  };

  const handleRefillPool = () => {
    const amount = parseFloat(poolRefillAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    refillPoolMut.mutate(
      { data: { amount } },
      {
        onSuccess: (data) => {
          toast({ title: "Pool Refilled!", description: data.message, className: "bg-success text-success-foreground border-none" });
          queryClient.invalidateQueries({ queryKey: ["/api/pool"] });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error?.error || "Failed to refill pool", variant: "destructive" });
        },
      }
    );
  };

  const handleRefillPlayer = () => {
    if (!selectedPlayer) {
      toast({ title: "No player selected", description: "Click a player row in the table below", variant: "destructive" });
      return;
    }
    const rawAmount = parseFloat(playerRefillAmount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid positive amount", variant: "destructive" });
      return;
    }
    const amount = balanceMode === "subtract" ? -rawAmount : rawAmount;
    refillPlayerMut.mutate(
      { data: { userId: selectedPlayer.id, amount } },
      {
        onSuccess: (data) => {
          const verb = balanceMode === "subtract" ? "Subtracted!" : "Added!";
          toast({ title: `Balance ${verb}`, description: data.message, className: "bg-success text-success-foreground border-none" });
          setSelectedPlayer((prev) => (prev ? { ...prev, balance: prev.balance + amount } : null));
          refetchPlayers();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error?.error || "Failed to update balance", variant: "destructive" });
        },
      }
    );
  };

  const handleResetAllBalances = () => {
    const newBalance = parseFloat(resetBalanceAmount);
    if (isNaN(newBalance) || newBalance < 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    resetAllBalancesMut.mutate(
      { data: { newBalance } },
      {
        onSuccess: (data) => {
          toast({ title: "Balances Reset!", description: data.message, className: "bg-success text-success-foreground border-none" });
          setConfirmReset(false);
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          refetchPlayers();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error?.error || "Failed to reset balances", variant: "destructive" });
          setConfirmReset(false);
        },
      }
    );
  };

  const handleTransfer = () => {
    const amount = parseFloat(transferAmount);
    if (!transferToUsername.trim()) {
      toast({ title: "Enter a username", variant: "destructive" });
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    transferMut.mutate(
      { data: { toUsername: transferToUsername.trim(), amount } },
      {
        onSuccess: (data) => {
          toast({ title: "Money Sent!", description: data.message, className: "bg-success text-success-foreground border-none" });
          setTransferToUsername("");
          setTransferAmount("100");
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        },
        onError: (err: any) => {
          toast({ title: "Transfer Failed", description: err.error?.error || "Something went wrong", variant: "destructive" });
        },
      }
    );
  };

  const handleSeize = () => {
    if (!seizePlayers) {
      toast({ title: "Select a player to seize from", variant: "destructive" });
      return;
    }
    const amount = parseFloat(seizeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (seizeDestination === "user" && !seizeToUserId) {
      toast({ title: "Select a destination user", variant: "destructive" });
      return;
    }
    seizesMut.mutate(
      { data: { fromUserId: seizePlayers.id, amount, destination: seizeDestination, toUserId: seizeToUserId ?? undefined } },
      {
        onSuccess: (data) => {
          toast({ title: "Assets Seized!", description: data.message, className: "bg-success text-success-foreground border-none" });
          setSeizePlayers(null);
          setSeizeAmount("10000");
          queryClient.invalidateQueries({ queryKey: ["/api/pool"] });
          refetchPlayers();
        },
        onError: (err: any) => {
          toast({ title: "Seize Failed", description: err.error?.error || "Something went wrong", variant: "destructive" });
        },
      }
    );
  };

  const handleForceReload = async () => {
    setForceReloadPending(true);
    try {
      const res = await fetch("/api/admin/force-reload", { method: "POST", credentials: "include" });
      if (res.ok) {
        toast({ title: "Reload Signal Sent!", description: "All connected players will reload within 3 seconds.", className: "bg-success text-success-foreground border-none" });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to send reload signal", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setForceReloadPending(false);
    }
  };

  const handleUpdateSettings = () => {
    const uCost = parseFloat(adminUsernameCost);
    const aCost = parseFloat(adminAvatarCost);
    if (isNaN(uCost) || isNaN(aCost) || uCost < 0 || aCost < 0) {
      toast({ title: "Invalid costs", variant: "destructive" });
      return;
    }
    updateSettingsMut.mutate(
      { data: { usernameChangeCost: uCost, avatarChangeCost: aCost } },
      {
        onSuccess: () => {
          toast({ title: "Settings Saved!", description: "Profile change costs updated.", className: "bg-success text-success-foreground border-none" });
          refetchSettings();
          queryClient.invalidateQueries({ queryKey: ["/api/user/profile-change-costs"] });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error?.error || "Failed to update settings", variant: "destructive" });
        },
      }
    );
  };

  const statCards = [
    { label: "Total Profit", value: formatCurrency(stats?.totalProfit || 0), icon: <Trophy className="w-5 h-5 text-yellow-400" />, color: stats?.totalProfit && stats.totalProfit > 0 ? "text-success" : "text-white" },
    { label: "Biggest Win", value: formatCurrency(stats?.biggestWin || 0), icon: <ArrowUpRight className="w-5 h-5 text-primary" /> },
    { label: "Games Played", value: formatNumber(stats?.gamesPlayed || 0), icon: <Gamepad2Icon className="w-5 h-5 text-secondary" /> },
    { label: "Win Rate", value: stats?.gamesPlayed ? `${((stats.totalWins / stats.gamesPlayed) * 100).toFixed(1)}%` : "0%", icon: <Target className="w-5 h-5 text-accent" /> },
    { label: "Current Streak", value: `${stats?.currentStreak || 0} Wins`, icon: <Flame className="w-5 h-5 text-orange-500" /> },
    { label: "Biggest Bet", value: formatCurrency(stats?.biggestBet || 0), icon: <Coins className="w-5 h-5 text-blue-400" /> },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in">
      {/* Header Profile Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-8 bg-card border border-white/5 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

        <div className="flex items-center gap-6 relative z-10">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = ""; }}
          />
          <div
            className="relative group cursor-pointer"
            onDragOver={(e) => { e.preventDefault(); setIsDraggingAvatar(true); }}
            onDragEnter={(e) => { e.preventDefault(); setIsDraggingAvatar(true); }}
            onDragLeave={() => setIsDraggingAvatar(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingAvatar(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleAvatarFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            title="Drag & drop or click to upload profile picture"
          >
            {isDraggingAvatar && (
              <div className="absolute inset-0 rounded-full z-20 bg-primary/30 border-2 border-primary border-dashed flex items-center justify-center">
                <Image className="w-6 h-6 text-primary" />
              </div>
            )}
            {changeAvatarMut.isPending && (
              <div className="absolute inset-0 rounded-full z-20 bg-black/60 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-20 h-20 rounded-full object-cover shadow-[0_0_20px_rgba(0,255,170,0.3)] border-2 border-primary/40 group-hover:brightness-75 transition-all"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_20px_rgba(0,255,170,0.3)] border-2 border-background group-hover:brightness-75 transition-all">
                <span className="text-3xl font-display font-bold text-background">
                  {user?.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-muted-foreground group-hover:text-white group-hover:border-primary/50 transition-all">
              <Image className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground">Drag & drop or click avatar</p>
            <button
              className="text-xs text-accent/70 hover:text-accent underline text-left mt-0.5"
              onClick={(e) => { e.stopPropagation(); setShowAvatarForm(true); setShowUsernameForm(false); }}
            >
              or paste URL instead
            </button>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold">{user?.username}</h1>
              {user?.isAdmin && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Admin
                </Badge>
              )}
              <button
                onClick={() => { setShowUsernameForm(true); setShowAvatarForm(false); }}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Change username"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              Joined {user ? format(new Date(user.createdAt), "MMM yyyy") : "..."}
            </p>
            {/* Referral Code */}
            {user?.referralCode && (
              <div className="flex items-center gap-2 mt-2">
                <Tag className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs text-muted-foreground">Referral code:</span>
                <span className="text-xs font-mono font-bold text-accent tracking-widest">{user.referralCode}</span>
                <button
                  onClick={handleCopyReferral}
                  className="text-muted-foreground hover:text-accent transition-colors"
                >
                  {referralCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 relative z-10 w-full md:w-auto">
          <div className="bg-black/50 px-6 py-3 rounded-2xl border border-white/5 flex flex-col items-end w-full md:w-auto">
            <span className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Available Balance</span>
            <span className="text-3xl font-mono font-bold text-primary neon-text-primary">
              {formatCurrency(user?.balance || 0)}
            </span>
          </div>
          <Button
            variant="outline"
            className={`w-full md:w-auto transition-all ${
              canClaim
                ? "bg-primary/10 hover:bg-primary/20 text-primary border-primary/40 hover:border-primary/70 shadow-[0_0_10px_rgba(0,255,170,0.15)]"
                : "bg-white/5 text-muted-foreground border-white/10 cursor-not-allowed"
            }`}
            onClick={canClaim ? handleClaim : undefined}
            disabled={claimMut.isPending || !canClaim}
          >
            <Gift className="w-4 h-4 mr-2" />
            {claimMut.isPending
              ? "Claiming..."
              : canClaim
              ? "Claim Daily $500"
              : `Next reward in ${countdownLabel}`}
          </Button>
        </div>
      </div>

      {/* Change Username Form */}
      {showUsernameForm && (
        <Card className="bg-black/60 border-primary/20">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Edit2 className="w-4 h-4 text-primary" /> Change Username</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Cost: <span className="text-primary font-mono font-bold">{formatCurrency(costs?.usernameChangeCost ?? 500)}</span> — deducted from your balance
                </p>
              </div>
              <button onClick={() => setShowUsernameForm(false)} className="text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="New username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                minLength={3}
                maxLength={30}
                className="bg-black/50"
              />
              <Button
                onClick={handleChangeUsername}
                disabled={changeUsernameMut.isPending || newUsername.trim().length < 3}
                className="shrink-0"
              >
                {changeUsernameMut.isPending ? "Saving..." : "Confirm"}
              </Button>
            </div>
            {costs && user && user.balance < costs.usernameChangeCost && (
              <p className="text-xs text-destructive">Insufficient balance. You need {formatCurrency(costs.usernameChangeCost)} to change your username.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Change Avatar Form */}
      {showAvatarForm && (
        <Card className="bg-black/60 border-accent/20">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Image className="w-4 h-4 text-accent" /> Change Profile Picture</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Cost: <span className="text-accent font-mono font-bold">{formatCurrency(costs?.avatarChangeCost ?? 250)}</span> — paste any image URL
                </p>
              </div>
              <button onClick={() => setShowAvatarForm(false)} className="text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="https://example.com/avatar.jpg"
                value={newAvatarUrl}
                onChange={(e) => setNewAvatarUrl(e.target.value)}
                className="bg-black/50"
              />
              <Button
                onClick={handleChangeAvatar}
                disabled={changeAvatarMut.isPending || !newAvatarUrl.trim()}
                className="shrink-0 bg-accent hover:bg-accent/80 text-black"
              >
                {changeAvatarMut.isPending ? "Saving..." : "Confirm"}
              </Button>
            </div>
            {newAvatarUrl.trim() && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <img src={newAvatarUrl} alt="preview" className="w-10 h-10 rounded-full object-cover border border-white/10" onError={() => {}} />
                Preview
              </div>
            )}
            {costs && user && user.balance < costs.avatarChangeCost && (
              <p className="text-xs text-destructive">Insufficient balance. You need {formatCurrency(costs.avatarChangeCost)} to change your avatar.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Send Money to Another Player */}
      {user && !user.isGuest && (
        <Card className="bg-card border-white/5">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ArrowUpRight className="w-5 h-5 text-primary" /> Send Money
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Transfer funds directly to another player's account.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Recipient username</label>
                <Input
                  value={transferToUsername}
                  onChange={(e) => setTransferToUsername(e.target.value)}
                  placeholder="e.g. highroller99"
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
                  <Input
                    type="number"
                    min="1"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="pl-7 bg-black/40 border-white/10 font-mono"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[100, 1000, 10000, 50000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTransferAmount(amt.toString())}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    transferAmount === amt.toString()
                      ? "bg-primary/20 border-primary/60 text-primary"
                      : "border-white/10 text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  ${amt.toLocaleString()}
                </button>
              ))}
            </div>
            <Button
              onClick={handleTransfer}
              disabled={transferMut.isPending || !transferToUsername.trim() || !parseFloat(transferAmount)}
              className="bg-primary hover:bg-primary/80 text-black font-bold gap-2"
            >
              <ArrowUpRight className="w-4 h-4" />
              {transferMut.isPending ? "Sending..." : `Send ${formatCurrency(parseFloat(transferAmount) || 0)} to ${transferToUsername || "..."}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Admin Panel removed — use /admin page */}
      {false && (
        <Card className="bg-yellow-950/20 border-yellow-500/20">
          <CardHeader className="border-b border-yellow-500/10">
            <CardTitle className="flex items-center gap-2 text-xl text-yellow-400">
              <ShieldAlert className="w-5 h-5" /> Admin Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-8">

            {/* Profile Change Costs */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-yellow-300 uppercase tracking-widest flex items-center gap-2">
                <Settings className="w-4 h-4" /> Profile Change Costs
              </h3>
              <p className="text-xs text-muted-foreground">Set how much players pay to change their username or profile picture.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-yellow-400 uppercase tracking-wider">Username Change Cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      value={adminUsernameCost}
                      onChange={(e) => setAdminUsernameCost(e.target.value)}
                      className="pl-7 bg-black/40 border-yellow-500/20 focus:border-yellow-500/50 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-yellow-400 uppercase tracking-wider">Avatar Change Cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      value={adminAvatarCost}
                      onChange={(e) => setAdminAvatarCost(e.target.value)}
                      className="pl-7 bg-black/40 border-yellow-500/20 focus:border-yellow-500/50 font-mono"
                    />
                  </div>
                </div>
              </div>
              <Button
                onClick={handleUpdateSettings}
                disabled={updateSettingsMut.isPending}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
              >
                {updateSettingsMut.isPending ? "Saving..." : "Save Costs"}
              </Button>
            </div>

            {/* Refill Pool */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-yellow-300 uppercase tracking-widest flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Refill Global Pool
              </h3>
              <p className="text-xs text-muted-foreground">Add funds to the global pool. This creates money out of thin air.</p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="1"
                    value={poolRefillAmount}
                    onChange={(e) => setPoolRefillAmount(e.target.value)}
                    className="pl-7 bg-black/40 border-yellow-500/20 focus:border-yellow-500/50 font-mono"
                    placeholder="Amount"
                  />
                </div>
                <Button
                  onClick={handleRefillPool}
                  disabled={refillPoolMut.isPending}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                >
                  {refillPoolMut.isPending ? "Refilling..." : "Refill Pool"}
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[100000, 500000, 1000000, 5000000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setPoolRefillAmount(amt.toString())}
                    className="text-xs px-3 py-1 rounded-full border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                  >
                    ${(amt / 1000000).toFixed(1)}M
                  </button>
                ))}
              </div>
            </div>

            {/* Force Reload All Players */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-orange-400 uppercase tracking-widest flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Force Reload All Players
              </h3>
              <p className="text-xs text-muted-foreground">
                Sends a signal to every connected browser — they will all refresh within 3 seconds.
              </p>
              <Button
                onClick={handleForceReload}
                disabled={forceReloadPending}
                variant="outline"
                className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${forceReloadPending ? "animate-spin" : ""}`} />
                {forceReloadPending ? "Sending Signal..." : "Reload Everyone's Browser"}
              </Button>
            </div>

            {/* Seize Assets */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-purple-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Seize Player Assets
              </h3>
              <p className="text-xs text-muted-foreground">Take money from a player and send it to the pool or another account.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Seize from</label>
                  <select
                    value={seizePlayers?.id ?? ""}
                    onChange={(e) => {
                      const p = playersData?.players.find((pl) => pl.id === parseInt(e.target.value));
                      setSeizePlayers(p ? { id: p.id, username: p.username } : null);
                    }}
                    className="w-full bg-black/40 border border-purple-500/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="">— Select player —</option>
                    {playersData?.players.filter((p) => !p.isAdmin).map((p) => (
                      <option key={p.id} value={p.id}>{p.username} ({formatCurrency(p.balance)})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Amount to seize</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400">$</span>
                    <Input
                      type="number"
                      min="1"
                      value={seizeAmount}
                      onChange={(e) => setSeizeAmount(e.target.value)}
                      className="pl-7 bg-black/40 border-purple-500/20 font-mono focus:border-purple-500/50"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Send seized funds to</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSeizeDestination("pool")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${seizeDestination === "pool" ? "bg-purple-500/20 border-purple-500/60 text-purple-300" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}
                  >
                    The Pool
                  </button>
                  <button
                    onClick={() => setSeizeDestination("user")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${seizeDestination === "user" ? "bg-purple-500/20 border-purple-500/60 text-purple-300" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}
                  >
                    Another Player
                  </button>
                </div>
                {seizeDestination === "user" && (
                  <select
                    value={seizeToUserId ?? ""}
                    onChange={(e) => setSeizeToUserId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full bg-black/40 border border-purple-500/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="">— Select destination player —</option>
                    {playersData?.players.filter((p) => p.id !== seizePlayers?.id).map((p) => (
                      <option key={p.id} value={p.id}>{p.username}</option>
                    ))}
                  </select>
                )}
              </div>
              <Button
                onClick={handleSeize}
                disabled={seizesMut.isPending || !seizePlayers || !parseFloat(seizeAmount)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                {seizesMut.isPending ? "Seizing..." : seizePlayers ? `Seize ${formatCurrency(parseFloat(seizeAmount) || 0)} from ${seizePlayers.username}` : "Seize Assets"}
              </Button>
            </div>

            {/* Force Reset All Balances */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-red-400 uppercase tracking-widest flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Force Reset All Balances
              </h3>
              <p className="text-xs text-muted-foreground">
                Set every non-admin player's balance to a specific amount. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    value={resetBalanceAmount}
                    onChange={(e) => { setResetBalanceAmount(e.target.value); setConfirmReset(false); }}
                    className="pl-7 bg-black/40 border-red-500/20 focus:border-red-500/50 font-mono"
                    placeholder="10000"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[0, 1000, 10000, 100000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { setResetBalanceAmount(amt.toString()); setConfirmReset(false); }}
                      className="text-xs px-3 py-1.5 rounded-full border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      ${amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              {!confirmReset ? (
                <Button
                  onClick={() => setConfirmReset(true)}
                  variant="outline"
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  Reset All Player Balances to {formatCurrency(parseFloat(resetBalanceAmount) || 0)}
                </Button>
              ) : (
                <div className="flex items-center gap-3 bg-red-950/30 border border-red-500/30 rounded-xl p-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-300">Are you sure?</p>
                    <p className="text-xs text-muted-foreground">This will reset ALL player balances to {formatCurrency(parseFloat(resetBalanceAmount) || 0)}.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmReset(false)}
                    className="text-muted-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleResetAllBalances}
                    disabled={resetAllBalancesMut.isPending}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold"
                  >
                    {resetAllBalancesMut.isPending ? "Resetting..." : "Confirm Reset"}
                  </Button>
                </div>
              )}
            </div>

            {/* Refill / Subtract Player */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-yellow-300 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4" /> Adjust Player Balance
                </h3>
                <div className="flex rounded-lg overflow-hidden border border-yellow-500/30 text-xs font-medium">
                  <button
                    onClick={() => setBalanceMode("add")}
                    className={`px-3 py-1.5 transition-colors ${balanceMode === "add" ? "bg-yellow-500 text-black" : "bg-black/40 text-yellow-400 hover:bg-yellow-500/10"}`}
                  >
                    + Add
                  </button>
                  <button
                    onClick={() => setBalanceMode("subtract")}
                    className={`px-3 py-1.5 transition-colors ${balanceMode === "subtract" ? "bg-red-500 text-white" : "bg-black/40 text-red-400 hover:bg-red-500/10"}`}
                  >
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
                    <button onClick={() => setSelectedPlayer(null)} className="text-muted-foreground hover:text-white transition-colors p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Amount to {balanceMode === "subtract" ? "subtract" : "add"}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold ${balanceMode === "subtract" ? "text-red-400" : "text-yellow-400"}`}>$</span>
                        <Input
                          type="number"
                          min="1"
                          value={playerRefillAmount}
                          onChange={(e) => setPlayerRefillAmount(e.target.value)}
                          className={`pl-7 bg-black/60 font-mono text-lg h-11 ${balanceMode === "subtract" ? "border-red-500/30 focus:border-red-500/60" : "border-yellow-500/30 focus:border-yellow-500/60"}`}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[1000, 10000, 50000, 100000].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setPlayerRefillAmount(amt.toString())}
                          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                            playerRefillAmount === amt.toString()
                              ? balanceMode === "subtract" ? "bg-red-500/20 border-red-500/60 text-red-300" : "bg-yellow-500/20 border-yellow-500/60 text-yellow-300"
                              : balanceMode === "subtract" ? "border-red-500/20 text-red-500 hover:bg-red-500/10" : "border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10"
                          }`}
                        >
                          {balanceMode === "subtract" ? "-" : "+"}${amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="flex-1 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
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

                  <Button
                    onClick={handleRefillPlayer}
                    disabled={refillPlayerMut.isPending || !parseFloat(playerRefillAmount)}
                    className={`w-full font-bold h-11 ${balanceMode === "subtract" ? "bg-red-600 hover:bg-red-500 text-white" : "bg-yellow-500 hover:bg-yellow-400 text-black"}`}
                  >
                    {refillPlayerMut.isPending
                      ? (balanceMode === "subtract" ? "Subtracting..." : "Adding Funds...")
                      : balanceMode === "subtract"
                        ? `Subtract ${formatCurrency(parseFloat(playerRefillAmount) || 0)} from ${selectedPlayer.username}`
                        : `Add ${formatCurrency(parseFloat(playerRefillAmount) || 0)} to ${selectedPlayer.username}`
                    }
                  </Button>
                </div>
              ) : (
                <div className="border border-dashed border-yellow-500/20 rounded-xl p-6 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 text-yellow-500/30" />
                  <p className="text-sm">
                    Click <span className="text-yellow-400 font-medium">Select</span> on any player in the table below to add funds to their account.
                  </p>
                </div>
              )}
            </div>

            {/* Players Table */}
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
                      <th className="px-4 py-3 text-left font-medium">ID</th>
                      <th className="px-4 py-3 text-left font-medium">Username</th>
                      <th className="px-4 py-3 text-left font-medium">Balance</th>
                      <th className="px-4 py-3 text-left font-medium">Games</th>
                      <th className="px-4 py-3 text-left font-medium">W/L</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-left font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-yellow-500/5">
                    {playersLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading players...</td>
                      </tr>
                    ) : (
                      playersData?.players.map((player) => {
                        const isSelected = selectedPlayer?.id === player.id;
                        return (
                          <tr
                            key={player.id}
                            className={`transition-colors cursor-pointer ${isSelected ? "bg-yellow-950/40 border-l-2 border-yellow-500" : "hover:bg-yellow-950/20"}`}
                            onClick={() => setSelectedPlayer(isSelected ? null : player)}
                          >
                            <td className="px-4 py-3 font-mono text-muted-foreground">{player.id}</td>
                            <td className="px-4 py-3 font-medium">{player.username}</td>
                            <td className="px-4 py-3 font-mono text-primary">{formatCurrency(player.balance)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{player.gamesPlayed}</td>
                            <td className="px-4 py-3 text-muted-foreground">{player.totalWins}W / {player.totalLosses}L</td>
                            <td className="px-4 py-3">
                              {player.isAdmin ? (
                                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs">Admin</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Player</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedPlayer(isSelected ? null : player); }}
                                className={`text-xs font-medium px-2 py-1 rounded transition-colors ${isSelected ? "bg-yellow-500/20 text-yellow-300" : "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"}`}
                              >
                                {isSelected ? "Selected ✓" : "Select"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-black/40 border-white/5">
            <CardContent className="p-6 flex flex-col justify-center items-center text-center space-y-2">
              <div className="p-3 bg-white/5 rounded-full mb-2">{stat.icon}</div>
              <h4 className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</h4>
              <p className={`text-xl md:text-2xl font-mono font-bold ${stat.color || "text-white"}`}>
                {statsLoading ? "-" : stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transactions */}
      <Card className="bg-black/40 border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-xl">
            <History className="w-5 h-5" /> Recent History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-white/5 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider">Game</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider">Bet</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider">Result</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Payout</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {txLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading...</td>
                  </tr>
                ) : txData?.transactions && txData.transactions.length > 0 ? (
                  txData.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="capitalize bg-black/50">{tx.gameType}</Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">{formatCurrency(tx.betAmount)}</td>
                      <td className="px-6 py-4">
                        {tx.result === "win" ? (
                          <Badge variant="success" className="bg-success/20 text-success border-none">
                            WIN {tx.multiplier ? `${tx.multiplier}x` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-destructive/20 text-destructive border-none">LOSS</Badge>
                        )}
                      </td>
                      <td className={`px-6 py-4 font-mono text-right font-medium ${tx.payout > 0 ? "text-success" : "text-muted-foreground"}`}>
                        {tx.payout > 0 ? "+" : ""}{formatCurrency(tx.payout)}
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground">
                        {format(new Date(tx.timestamp), "MMM d, HH:mm")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No transactions yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {txData && txData.total > limit && (
            <div className="p-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {page * limit + 1} to {Math.min((page + 1) * limit, txData.total)} of {txData.total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * limit >= txData.total}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Gamepad2Icon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" x2="10" y1="12" y2="12" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="15" x2="15.01" y1="13" y2="13" />
      <line x1="18" x2="18.01" y1="11" y2="11" />
      <rect width="20" height="12" x="2" y="6" rx="2" />
    </svg>
  );
}
