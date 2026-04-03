import React, { useState, useEffect, useRef, useCallback } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Users, Send, Plus, Hash, Lock, Globe,
  UserPlus, Check, X, Trash2, RefreshCw, ChevronRight, Crown,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

interface ChatRoom { id: number; name: string; type: string; unreadCount: number; lastMessage: any; otherUser: any; }
interface Message { id: number; content: string; createdAt: string; userId: number | null; username: string | null; avatarUrl: string | null; isAdminBroadcast: boolean; }
interface Friend { id: number; user: { id: number; username: string; avatarUrl: string | null } | null; since: string; }
interface FriendRequest { id: number; from: { id: number; username: string; avatarUrl: string | null } | null; createdAt: string; }

function useApi<T>(url: string, deps: any[] = [], interval?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}${url}`, { credentials: "include" });
      if (r.ok) setData(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, deps);
  useEffect(() => {
    fetch_();
    if (interval) { const t = setInterval(fetch_, interval); return () => clearInterval(t); }
  }, [fetch_]);
  return { data, loading, refetch: fetch_ };
}

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${url}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
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

function ChatPanel({ room, userId }: { room: ChatRoom; userId: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevRoomId = useRef<number | null>(null);
  const isNearBottom = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isNearBottom.current = scrollHeight - scrollTop - clientHeight < 120;
  };

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiFetch(`api/chat/rooms/${room.id}/messages?limit=60`);
      setMessages(data.messages ?? []);
    } catch {}
  }, [room.id]);

  useEffect(() => {
    const changed = prevRoomId.current !== room.id;
    prevRoomId.current = room.id;
    if (changed) isNearBottom.current = true;
    loadMessages();
    const t = setInterval(loadMessages, 3000);
    if (changed) setTimeout(() => scrollToBottom("instant"), 100);
    return () => clearInterval(t);
  }, [loadMessages, room.id]);

  useEffect(() => {
    if (isNearBottom.current) scrollToBottom("smooth");
  }, [messages.length]);

  const markRead = useCallback(async () => {
    try { await apiFetch(`api/chat/rooms/${room.id}/read`, { method: "POST" }); } catch {}
  }, [room.id]);

  useEffect(() => { markRead(); }, [room.id]);

  const { toast } = useToast();

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      const data = await apiFetch(`api/chat/rooms/${room.id}/messages`, { method: "POST", body: JSON.stringify({ content: text }) });
      setMessages(prev => [...prev, data.message]);
      isNearBottom.current = true;
      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch (err: any) {
      setInput(text);
      toast({ title: "Failed to send", description: err.message ?? "Please try again", variant: "destructive" });
    } finally { setSending(false); }
    inputRef.current?.focus();
  };

  const grouped = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const d = new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!acc.length || acc[acc.length - 1].date !== d) acc.push({ date: d, msgs: [] });
    acc[acc.length - 1].msgs.push(msg);
    return acc;
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-xs text-muted-foreground px-2">{group.date}</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="space-y-1">
              {group.msgs.map((msg, i) => {
                const isMe = msg.userId === userId;
                const isBroadcast = msg.isAdminBroadcast;
                const showAvatar = !isMe && (i === 0 || group.msgs[i - 1].userId !== msg.userId);
                const showName = !isMe && showAvatar;
                const time = new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

                if (isBroadcast) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2 max-w-md">
                        <Crown className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                        <span className="text-xs text-yellow-300 font-medium">Admin: {msg.content}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} ${showAvatar ? "mt-3" : "mt-0.5"}`}>
                    <div className={`flex-shrink-0 ${showAvatar ? "" : "w-8"}`}>
                      {showAvatar && <Avatar username={msg.username ?? "?"} avatarUrl={msg.avatarUrl} size={8} />}
                    </div>
                    <div className={`flex flex-col max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
                      {showName && <span className="text-xs text-muted-foreground mb-1 px-1">{msg.username}</span>}
                      <div className={`px-3 py-2 rounded-2xl text-sm break-words leading-relaxed ${
                        isMe ? "bg-primary text-black rounded-tr-sm" : "bg-white/10 text-foreground rounded-tl-sm"
                      }`}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 mt-0.5 px-1">{time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="p-3 border-t border-white/5 flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message #${room.name.toLowerCase()}`}
          maxLength={500}
          className="flex-1 bg-white/5 border-white/10 focus:border-primary/50"
          disabled={sending}
          autoComplete="off"
        />
        <Button type="submit" disabled={!input.trim() || sending} size="icon" className="bg-primary hover:bg-primary/80 text-black flex-shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}

function RoomList({ rooms, activeRoomId, onSelect, onCreateRoom, onJoinPublic }: any) {
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [showPublic, setShowPublic] = useState(false);
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const { toast } = useToast();

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      await onCreateRoom(newRoomName.trim(), newRoomPrivate);
      setNewRoomName(""); setNewRoomPrivate(false); setShowCreate(false);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const loadPublic = async () => {
    const data = await apiFetch("api/chat/rooms/public");
    setPublicRooms(data.rooms ?? []);
    setShowPublic(true);
  };

  const groups = {
    general: rooms.filter((r: ChatRoom) => r.type === "general"),
    public: rooms.filter((r: ChatRoom) => r.type === "public"),
    private: rooms.filter((r: ChatRoom) => r.type === "private"),
    group: rooms.filter((r: ChatRoom) => r.type === "group"),
    dm: rooms.filter((r: ChatRoom) => r.type === "dm"),
  };

  const renderRoom = (room: ChatRoom) => (
    <button key={room.id} onClick={() => onSelect(room)}
      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all group ${activeRoomId === room.id ? "bg-primary/20 text-primary" : "hover:bg-white/5 text-muted-foreground hover:text-foreground"}`}>
      {room.type === "dm" ? (
        <Avatar username={room.otherUser?.username} avatarUrl={room.otherUser?.avatarUrl} size={6} />
      ) : (
        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0 ${room.type === "general" ? "bg-primary/20 text-primary" : room.type === "private" ? "bg-purple-500/20 text-purple-400" : "bg-white/10"}`}>
          {room.type === "general" ? <Globe className="w-3 h-3" /> : room.type === "private" ? <Lock className="w-3 h-3" /> : room.type === "group" ? <Users className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
        </div>
      )}
      <span className="flex-1 text-sm font-medium truncate">
        {room.type === "dm" ? (room.otherUser?.username ?? "Unknown") : room.name}
      </span>
      {room.unreadCount > 0 && (
        <span className="bg-primary text-black text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">
          {room.unreadCount > 99 ? "99+" : room.unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 p-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Chats</span>
        <div className="flex gap-1">
          <button onClick={loadPublic} title="Browse public rooms" className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
            <Globe className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowCreate(!showCreate)} title="Create room" className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="flex-shrink-0 p-3 border-b border-white/5 space-y-2">
          <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="Room name..."
            className="bg-white/5 border-white/10 text-sm h-8" onKeyDown={e => e.key === "Enter" && createRoom()} autoFocus />
          <button onClick={() => setNewRoomPrivate(v => !v)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg border text-xs transition-colors ${newRoomPrivate ? "bg-purple-500/10 border-purple-500/40 text-purple-300" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
            <Lock className="w-3 h-3" />
            {newRoomPrivate ? "Invite Only — only you can add people" : "Public — anyone can join"}
          </button>
          <div className="flex gap-2">
            <Button size="sm" onClick={createRoom} className="flex-1 h-7 text-xs bg-primary text-black">Create</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewRoomPrivate(false); }} className="h-7 text-xs">Cancel</Button>
          </div>
        </div>
      )}

      {showPublic && (
        <div className="flex-shrink-0 p-3 border-b border-white/5 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Public Rooms</span>
            <button onClick={() => setShowPublic(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
          </div>
          {publicRooms.length === 0 && <p className="text-xs text-muted-foreground">No public rooms yet.</p>}
          {publicRooms.map(r => (
            <button key={r.id} onClick={() => { onJoinPublic(r.id); setShowPublic(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left text-sm">
              <Hash className="w-3 h-3 text-muted-foreground" />
              <span className="flex-1 truncate">{r.name}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
        {groups.general.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 mb-1">General</p>
            {groups.general.map(renderRoom)}
          </div>
        )}
        {groups.public.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 mb-1">Public Rooms</p>
            {groups.public.map(renderRoom)}
          </div>
        )}
        {groups.private.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 mb-1 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Private Rooms
            </p>
            {groups.private.map(renderRoom)}
          </div>
        )}
        {groups.group.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 mb-1">Groups</p>
            {groups.group.map(renderRoom)}
          </div>
        )}
        {groups.dm.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 mb-1">Direct Messages</p>
            {groups.dm.map(renderRoom)}
          </div>
        )}
      </div>
    </div>
  );
}

function FriendsPanel({ userId, onOpenDm }: { userId: number; onOpenDm: (friendUserId: number) => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("api/friends");
      setFriends(data.friends ?? []);
      setIncoming(data.incoming ?? []);
      setOutgoing(data.outgoing ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch(`api/users/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data.users ?? []);
      } catch {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const sendRequest = async (username: string) => {
    if (!username.trim()) return;
    try {
      const data = await apiFetch("api/friends/request", { method: "POST", body: JSON.stringify({ username: username.trim() }) });
      toast({ title: "Request Sent!", description: data.message, className: "bg-success text-success-foreground border-none" });
      setSearchQuery("");
      setSearchResults([]);
      load();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const accept = async (id: number) => {
    try { await apiFetch(`api/friends/${id}/accept`, { method: "POST" }); load(); } catch {}
  };
  const decline = async (id: number) => {
    try { await apiFetch(`api/friends/${id}/decline`, { method: "POST" }); load(); } catch {}
  };
  const remove = async (id: number) => {
    try { await apiFetch(`api/friends/${id}`, { method: "DELETE" }); load(); } catch {}
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
      {/* Add Friend — live search */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Add Friend</h3>
        <div ref={searchRef} className="relative">
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by username..."
            className="bg-white/5 border-white/10 w-full pr-8" autoComplete="off" />
          {searching && <RefreshCw className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {searchResults.map(u => {
                const isFriend = friends.some(f => f.user?.id === u.id);
                const isPending = outgoing.some(o => o.to?.id === u.id);
                return (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors">
                    <Avatar username={u.username} avatarUrl={u.avatarUrl} size={6} />
                    <span className="flex-1 text-sm font-medium">{u.username}</span>
                    {isFriend ? (
                      <span className="text-[10px] text-primary font-medium px-2 py-0.5 rounded-full bg-primary/10">Friends</span>
                    ) : isPending ? (
                      <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-white/5">Pending</span>
                    ) : (
                      <button onClick={() => sendRequest(u.username)}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-white/10 rounded-xl shadow-xl px-3 py-3">
              <p className="text-xs text-muted-foreground">No users found for "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Incoming Requests */}
      {incoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            Pending Requests
            <span className="bg-primary text-black text-[10px] font-bold rounded-full px-1.5">{incoming.length}</span>
          </h3>
          {incoming.map(req => (
            <div key={req.id} className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3">
              <Avatar username={req.from?.username} avatarUrl={req.from?.avatarUrl} />
              <span className="flex-1 text-sm font-medium">{req.from?.username ?? "Unknown"}</span>
              <button onClick={() => accept(req.id)} className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => decline(req.id)} className="p-1.5 rounded-lg bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Friends List */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Friends {friends.length > 0 && `(${friends.length})`}
        </h3>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!loading && friends.length === 0 && (
          <p className="text-sm text-muted-foreground">No friends yet. Search for someone above!</p>
        )}
        {friends.map(f => (
          <div key={f.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
            <Avatar username={f.user?.username} avatarUrl={f.user?.avatarUrl} />
            <span className="flex-1 text-sm font-medium">{f.user?.username ?? "Unknown"}</span>
            <div className="flex gap-1">
              {f.user && (
                <button onClick={() => onOpenDm(f.user!.id)} title="Send message" className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => remove(f.id)} title="Remove friend" className="p-1.5 rounded-lg bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Outgoing Requests */}
      {outgoing.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sent Requests</h3>
          {outgoing.map(req => (
            <div key={req.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              <Avatar username={req.to?.username} avatarUrl={req.to?.avatarUrl} />
              <span className="flex-1 text-sm font-medium text-muted-foreground">{req.to?.username ?? "Unknown"}</span>
              <span className="text-xs text-muted-foreground/60">Pending</span>
              <button onClick={() => decline(req.id)} className="p-1.5 rounded-lg bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [tab, setTab] = useState<"chat" | "friends">("chat");
  const [showMobileRooms, setShowMobileRooms] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const { toast } = useToast();

  const loadRooms = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch("api/chat/rooms");
      const r: ChatRoom[] = data.rooms ?? [];
      setRooms(r);
      if (!activeRoom && r.length > 0) setActiveRoom(r.find(x => x.type === "general") ?? r[0]);
      else if (activeRoom) setActiveRoom(prev => r.find(x => x.id === prev?.id) ?? prev);
    } catch {}
  }, [user, activeRoom?.id]);

  useEffect(() => { loadRooms(); const t = setInterval(loadRooms, 5000); return () => clearInterval(t); }, [loadRooms]);

  useEffect(() => {
    if (!user) return;
    apiFetch("api/friends").then(d => setFriends(d.friends ?? [])).catch(() => {});
  }, [user]);

  const handleCreateRoom = async (name: string, isPrivate: boolean) => {
    const data = await apiFetch("api/chat/rooms", { method: "POST", body: JSON.stringify({ name, isPrivate }) });
    await loadRooms();
    if (data.room) setActiveRoom({ ...data.room, unreadCount: 0, lastMessage: null, otherUser: null });
  };

  const handleInvite = async (friendUserId: number, roomId: number) => {
    try {
      const data = await apiFetch(`api/chat/rooms/${roomId}/invite/${friendUserId}`, { method: "POST" });
      toast({ title: "Invited!", description: data.message, className: "bg-success text-success-foreground border-none" });
      setShowInvite(false);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleJoinPublic = async (roomId: number) => {
    try {
      await apiFetch(`api/chat/rooms/${roomId}/join`, { method: "POST" });
      await loadRooms();
      toast({ title: "Joined!", className: "bg-success text-success-foreground border-none" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleOpenDm = async (friendUserId: number) => {
    try {
      const data = await apiFetch(`api/chat/dm/${friendUserId}`, { method: "POST" });
      await loadRooms();
      setTab("chat");
      setTimeout(() => setRooms(prev => {
        const r = prev.find(x => x.id === data.roomId);
        if (r) setActiveRoom(r);
        return prev;
      }), 300);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleSelectRoom = (room: ChatRoom) => {
    setActiveRoom(room);
    setShowMobileRooms(false);
    setTab("chat");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <div className="space-y-4">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">Please log in to use chat.</p>
          <Button onClick={() => window.location.href = "/login"}>Log In</Button>
        </div>
      </div>
    );
  }

  const totalUnread = rooms.reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-1 min-h-0 border-t border-white/5 bg-black/40">
        {/* Sidebar */}
        <div className={`flex flex-col w-64 flex-shrink-0 border-r border-white/5 bg-black/20 ${showMobileRooms ? "block" : "hidden md:flex"}`}>
          {/* Tabs */}
          <div className="flex border-b border-white/5 flex-shrink-0">
            <button onClick={() => setTab("chat")}
              className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${tab === "chat" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <MessageSquare className="w-3.5 h-3.5" />
              Chats
              {totalUnread > 0 && tab !== "chat" && <span className="bg-primary text-black text-[10px] rounded-full px-1 font-bold">{totalUnread}</span>}
            </button>
            <button onClick={() => setTab("friends")}
              className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${tab === "friends" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Users className="w-3.5 h-3.5" />
              Friends
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === "chat" ? (
              <RoomList rooms={rooms} activeRoomId={activeRoom?.id} onSelect={handleSelectRoom}
                onCreateRoom={handleCreateRoom} onJoinPublic={handleJoinPublic} />
            ) : (
              <FriendsPanel userId={user.id} onOpenDm={handleOpenDm} />
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeRoom ? (
            <>
              {/* Room Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/20 relative flex-shrink-0">
                <button onClick={() => setShowMobileRooms(!showMobileRooms)} className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground">
                  <MessageSquare className="w-4 h-4" />
                </button>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activeRoom.type === "general" ? "bg-primary/20" : activeRoom.type === "private" ? "bg-purple-500/20" : "bg-white/10"}`}>
                  {activeRoom.type === "dm"
                    ? <Avatar username={activeRoom.otherUser?.username} avatarUrl={activeRoom.otherUser?.avatarUrl} size={8} />
                    : activeRoom.type === "general" ? <Globe className="w-4 h-4 text-primary" />
                    : activeRoom.type === "private" ? <Lock className="w-4 h-4 text-purple-400" />
                    : activeRoom.type === "group" ? <Users className="w-4 h-4 text-muted-foreground" />
                    : <Hash className="w-4 h-4 text-muted-foreground" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {activeRoom.type === "dm" ? (activeRoom.otherUser?.username ?? "DM") : activeRoom.name}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{activeRoom.type === "dm" ? "Direct Message" : activeRoom.type === "private" ? "Invite Only" : activeRoom.type}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {(activeRoom.type === "private" || activeRoom.type === "public" || activeRoom.type === "group") && friends.length > 0 && (
                    <div className="relative">
                      <button onClick={() => setShowInvite(v => !v)}
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-colors">
                        <UserPlus className="w-3 h-3" /> Invite
                      </button>
                      {showInvite && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-card border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                          <div className="p-2 border-b border-white/5 flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground px-1">Invite a friend</span>
                            <button onClick={() => setShowInvite(false)} className="p-0.5 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {friends.map(f => f.user && (
                              <button key={f.id} onClick={() => handleInvite(f.user!.id, activeRoom.id)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left">
                                <Avatar username={f.user.username} avatarUrl={f.user.avatarUrl} size={6} />
                                <span className="text-sm flex-1 truncate">{f.user.username}</span>
                                <UserPlus className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {activeRoom.type !== "general" && (
                    <button onClick={async () => {
                      await apiFetch(`api/chat/rooms/${activeRoom.id}/leave`, { method: "POST" });
                      loadRooms();
                      setActiveRoom(rooms.find(r => r.type === "general") ?? null);
                      setShowInvite(false);
                    }} className="text-xs text-muted-foreground hover:text-red-400 transition-colors">
                      Leave
                    </button>
                  )}
                </div>
              </div>
              <ChatPanel key={activeRoom.id} room={activeRoom} userId={user.id} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div className="space-y-3">
                <Hash className="w-12 h-12 mx-auto text-muted-foreground/20" />
                <p className="text-muted-foreground">Select a chat or create one</p>
                <Button variant="outline" size="sm" onClick={() => setShowMobileRooms(true)} className="md:hidden">
                  Open Chats
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
