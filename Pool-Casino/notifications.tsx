import React, { useState, useEffect, useCallback } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, UserPlus, Check, X, Bell, BellOff,
  ChevronRight, Hash, Globe, Users, RefreshCw, Ban, AlertTriangle, Clock, ShieldOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function Avatar({ username, avatarUrl, size = 8 }: { username?: string; avatarUrl?: string | null; size?: number }) {
  const s = `w-${size} h-${size}`;
  if (avatarUrl) return <img src={avatarUrl} className={`${s} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${s} rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-white/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary`}>
      {username?.charAt(0).toUpperCase() ?? "?"}
    </div>
  );
}

interface FriendRequest {
  id: number;
  from: { id: number; username: string; avatarUrl: string | null } | null;
  createdAt: string;
}

interface UnreadRoom {
  id: number;
  name: string;
  type: string;
  unreadCount: number;
  otherUser: { id: number; username: string; avatarUrl: string | null } | null;
  lastMessage: { content: string; username: string | null; createdAt: string } | null;
}

function formatTimeRemaining(until: string): string {
  const diff = new Date(until).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 2) return `${d} days`;
  if (h >= 1) return `${h} hour${h !== 1 ? "s" : ""}`;
  const m = Math.floor(diff / 60000);
  return `${m} minute${m !== 1 ? "s" : ""}`;
}

export default function Notifications() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [unreadRooms, setUnreadRooms] = useState<UnreadRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [appealText, setAppealText] = useState("");
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [friendsData, roomsData] = await Promise.all([
        apiFetch("api/friends"),
        apiFetch("api/chat/rooms"),
      ]);
      setFriendRequests(friendsData.incoming ?? []);
      setUnreadRooms((roomsData.rooms ?? []).filter((r: UnreadRoom) => r.unreadCount > 0));
    } catch {}
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const accept = async (id: number) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await apiFetch(`api/friends/${id}/accept`, { method: "POST" });
      toast({ title: "Friend added!", className: "bg-success text-success-foreground border-none" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const decline = async (id: number) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await apiFetch(`api/friends/${id}/decline`, { method: "POST" });
      load();
    } catch {} finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const openRoom = async (room: UnreadRoom) => {
    try {
      await apiFetch(`api/chat/rooms/${room.id}/read`, { method: "POST" });
    } catch {}
    navigate("/chat");
  };

  const submitAppeal = async () => {
    if (appealText.trim().length < 10) {
      toast({ title: "Too short", description: "Please write at least 10 characters explaining your appeal.", variant: "destructive" });
      return;
    }
    setAppealSubmitting(true);
    try {
      await apiFetch("api/user/appeal", { method: "POST", body: JSON.stringify({ message: appealText }) });
      setAppealSubmitted(true);
      setAppealOpen(false);
      toast({ title: "Appeal submitted!", description: "An admin will review your appeal.", className: "bg-success text-success-foreground border-none" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setAppealSubmitting(false); }
  };

  const u = user as any;
  const now = new Date();
  const isPermanentlyBanned = u?.permanentlyBanned === true;
  const isBanned = !isPermanentlyBanned && u?.bannedUntil && new Date(u.bannedUntil) > now;
  const isSuspended = !isPermanentlyBanned && !isBanned && u?.suspendedUntil && new Date(u.suspendedUntil) > now;
  const hasPunishment = isPermanentlyBanned || isBanned || isSuspended;

  const total = friendRequests.length + unreadRooms.length;

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <div className="space-y-4">
          <Bell className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">Please log in to see notifications.</p>
          <Button onClick={() => navigate("/login")}>Log In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            Notifications
            {total > 0 && (
              <span className="bg-primary text-black text-sm font-bold rounded-full px-2.5 py-0.5">
                {total}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Friend requests and unread messages</p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* ── Ban / Suspension Notice ────────────────────────────────────────── */}
      {hasPunishment && (
        <div className={`rounded-2xl border p-5 space-y-4 ${
          isPermanentlyBanned ? "border-red-500/40 bg-red-900/20" :
          isBanned ? "border-orange-500/40 bg-orange-900/20" :
          "border-yellow-500/30 bg-yellow-900/10"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isPermanentlyBanned ? "bg-red-500/20" : isBanned ? "bg-orange-500/20" : "bg-yellow-500/20"
            }`}>
              {isPermanentlyBanned ? <Ban className="w-5 h-5 text-red-400" /> :
               isBanned ? <ShieldOff className="w-5 h-5 text-orange-400" /> :
               <Clock className="w-5 h-5 text-yellow-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-sm ${
                isPermanentlyBanned ? "text-red-300" : isBanned ? "text-orange-300" : "text-yellow-300"
              }`}>
                {isPermanentlyBanned ? "Account Permanently Banned" :
                 isBanned ? "Account Banned" :
                 "Chat Suspended"}
              </h3>
              <p className="text-xs text-white/60 mt-0.5">
                {isPermanentlyBanned
                  ? "Your account has been permanently banned from PoolCasino."
                  : isBanned
                  ? `You are banned from playing games. Time remaining: ${formatTimeRemaining(u.bannedUntil)}.`
                  : `Your chat access is suspended. Time remaining: ${formatTimeRemaining(u.suspendedUntil)}.`}
              </p>
              {u?.banReason && (
                <p className="text-xs mt-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70">
                  <span className="font-medium text-white/50 mr-1">Reason:</span>{u.banReason}
                </p>
              )}
            </div>
          </div>

          {/* Appeal section */}
          {appealSubmitted ? (
            <div className="rounded-xl bg-green-900/20 border border-green-500/30 px-4 py-3 text-xs text-green-300">
              ✓ Your appeal has been submitted and is under review.
            </div>
          ) : appealOpen ? (
            <div className="space-y-2">
              <label className="text-xs text-white/50 uppercase tracking-wider">Your appeal message</label>
              <textarea
                value={appealText}
                onChange={e => setAppealText(e.target.value)}
                rows={3}
                placeholder="Explain why you believe this action was incorrect or ask for reconsideration..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20 resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" className="bg-primary hover:bg-primary/80 text-black font-bold" disabled={appealSubmitting} onClick={submitAppeal}>
                  {appealSubmitting ? "Submitting..." : "Submit Appeal"}
                </Button>
                <Button size="sm" variant="ghost" className="text-white/40 hover:text-white/60" onClick={() => setAppealOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className={`border-white/20 hover:bg-white/5 text-white/70 gap-2 ${
                isPermanentlyBanned ? "border-red-500/30 text-red-300 hover:bg-red-900/20" :
                isBanned ? "border-orange-500/30 text-orange-300 hover:bg-orange-900/20" :
                "border-yellow-500/30 text-yellow-300 hover:bg-yellow-900/20"
              }`}
              onClick={() => setAppealOpen(true)}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Appeal this decision
            </Button>
          )}
        </div>
      )}

      {total === 0 && !hasPunishment ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <BellOff className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium">You're all caught up!</p>
          <p className="text-sm text-muted-foreground/60">No pending friend requests or unread messages.</p>
        </div>
      ) : total > 0 ? (
        <div className="space-y-4">
          {/* Friend Requests Section */}
          {friendRequests.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5" />
                Friend Requests
                <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {friendRequests.length}
                </span>
              </h2>
              <div className="space-y-2">
                {friendRequests.map(req => (
                  <div key={req.id}
                    className="flex items-center gap-4 bg-primary/5 border border-primary/20 rounded-2xl p-4 hover:bg-primary/10 transition-colors">
                    <Avatar username={req.from?.username} avatarUrl={req.from?.avatarUrl} size={10} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{req.from?.username ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        Sent {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => accept(req.id)}
                        disabled={processingIds.has(req.id)}
                        className="bg-primary hover:bg-primary/80 text-black gap-1.5 font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => decline(req.id)}
                        disabled={processingIds.has(req.id)}
                        className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unread Messages Section */}
          {unreadRooms.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" />
                Unread Messages
                <span className="bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {unreadRooms.reduce((sum, r) => sum + r.unreadCount, 0)}
                </span>
              </h2>
              <div className="space-y-2">
                {unreadRooms.map(room => {
                  const isDm = room.type === "dm";
                  const displayName = isDm ? (room.otherUser?.username ?? "DM") : room.name;
                  const RoomIcon = room.type === "general" ? Globe : room.type === "group" ? Users : Hash;

                  return (
                    <button
                      key={room.id}
                      onClick={() => openRoom(room)}
                      className="w-full flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                    >
                      <div className="relative flex-shrink-0">
                        {isDm ? (
                          <Avatar username={room.otherUser?.username} avatarUrl={room.otherUser?.avatarUrl} size={10} />
                        ) : (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            room.type === "general" ? "bg-primary/20 border-primary/30 text-primary" : "bg-white/10 border-white/10 text-muted-foreground"
                          }`}>
                            <RoomIcon className="w-5 h-5" />
                          </div>
                        )}
                        <span className="absolute -top-1 -right-1 bg-primary text-black text-[10px] font-bold rounded-full px-1.5 py-px min-w-[18px] text-center leading-none">
                          {room.unreadCount > 99 ? "99+" : room.unreadCount}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{displayName}</p>
                          <span className="text-[10px] text-muted-foreground capitalize px-1.5 py-0.5 bg-white/5 rounded-full">
                            {room.type === "dm" ? "DM" : room.type}
                          </span>
                        </div>
                        {room.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {room.lastMessage.username ? (
                              <span className="text-foreground/70 font-medium">{room.lastMessage.username}: </span>
                            ) : null}
                            {room.lastMessage.content}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground">
                          {room.lastMessage ? new Date(room.lastMessage.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
