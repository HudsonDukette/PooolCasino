import React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useGetPool, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Coins, LogOut, User as UserIcon, Menu, X, Dices, Crown, LayoutDashboard, MessageSquare, UserPlus, ShieldAlert, Bell, Banknote, Ban, MicOff, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${url}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false, refetchInterval: 3000 } });
  const { data: pool } = useGetPool({ query: { refetchInterval: 3000 } });
  const logoutMut = useLogout();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [gamesDropdownOpen, setGamesDropdownOpen] = React.useState(false);
  const gamesDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (gamesDropdownRef.current && !gamesDropdownRef.current.contains(e.target as Node)) {
        setGamesDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);
  const initialForceReloadAt = React.useRef<number | null>(null);
  usePushNotifications((user as any)?.id);

  const [unreadCount, setUnreadCount] = React.useState(0);
  const [pendingFriends, setPendingFriends] = React.useState(0);
  const [pendingAdminCount, setPendingAdminCount] = React.useState(0);
  const [showMoneyModal, setShowMoneyModal] = React.useState(false);
  const [showAppealModal, setShowAppealModal] = React.useState(false);
  const [appealMsg, setAppealMsg] = React.useState("");
  const [appealPending, setAppealPending] = React.useState(false);
  const [moneyAmount, setMoneyAmount] = React.useState("10000");
  const [moneyMsg, setMoneyMsg] = React.useState("");
  const [moneyPending, setMoneyPending] = React.useState(false);

  React.useEffect(() => {
    if (!pool?.forceReloadAt) return;
    if (initialForceReloadAt.current === null) {
      initialForceReloadAt.current = pool.forceReloadAt;
      return;
    }
    if (pool.forceReloadAt !== initialForceReloadAt.current) {
      window.location.reload();
    }
  }, [pool?.forceReloadAt]);

  React.useEffect(() => {
    if (!user || user.isGuest) return;
    const poll = async () => {
      try {
        const [chatData, friendsData] = await Promise.all([
          fetch(`${BASE}api/chat/unread`, { credentials: "include" }).then(r => r.ok ? r.json() : { unreadCount: 0 }),
          fetch(`${BASE}api/friends`, { credentials: "include" }).then(r => r.ok ? r.json() : { incoming: [] }),
        ]);
        setUnreadCount(chatData.unreadCount ?? 0);
        setPendingFriends((friendsData.incoming ?? []).length);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [user?.id]);

  React.useEffect(() => {
    if (!(user as any)?.isAdmin) return;
    const fetchCount = async () => {
      try {
        const r = await fetch(`${BASE}api/admin/pending-count`, { credentials: "include" });
        if (r.ok) { const d = await r.json(); setPendingAdminCount(d.count ?? 0); }
      } catch {}
    };
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => clearInterval(t);
  }, [(user as any)?.isAdmin, (user as any)?.id]);

  const handleAppeal = async () => {
    if (!appealMsg.trim()) return;
    setAppealPending(true);
    try {
      await apiFetch("api/user/appeal", { method: "POST", body: JSON.stringify({ message: appealMsg }) });
      toast({ title: "Appeal Submitted", description: "An admin will review your appeal soon.", className: "bg-success text-success-foreground border-none" });
      setShowAppealModal(false);
      setAppealMsg("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setAppealPending(false); }
  };

  const isGuest = user?.isGuest === true;
  useGuestSession(!!user && !isGuest, isLoading);

  const handleLogout = () => {
    logoutMut.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/login";
      }
    });
  };

  const handleRequestMoney = async () => {
    const amount = parseFloat(moneyAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setMoneyPending(true);
    try {
      const data = await apiFetch("api/money-request", { method: "POST", body: JSON.stringify({ amount, message: moneyMsg.trim() || undefined }) });
      toast({ title: "Request Sent!", description: data.message, className: "bg-success text-success-foreground border-none" });
      setShowMoneyModal(false);
      setMoneyMsg("");
      setMoneyAmount("10000");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setMoneyPending(false); }
  };

  const totalNotifs = unreadCount + pendingFriends;

  const u = user as any;
  const isBanned = u && (u.permanentlyBanned || (u.bannedUntil && new Date(u.bannedUntil) > new Date()));
  const isSuspended = u && !isBanned && u.suspendedUntil && new Date(u.suspendedUntil) > new Date();

  const navLinks = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: "/chat", label: "", icon: <MessageSquare className="w-4 h-4" />, title: "Chat" },
    { href: "/leaderboard", label: "Leaderboards", icon: <Crown className="w-4 h-4" /> },
    ...(u?.isAdmin ? [{ href: "/admin", label: (u as any)?.isOwner ? "Owner" : "Admin", icon: <ShieldAlert className="w-4 h-4" />, badge: pendingAdminCount || null }] : []),
  ];

  const isGamesActive = location.startsWith("/games") || location === "/multiplayer" || location === "/casinos";

  const isChat = location === "/chat";

  return (
    <div className={`bg-background text-foreground flex flex-col overflow-x-hidden ${isChat ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center gap-2 group cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_15px_rgba(0,255,170,0.4)] group-hover:shadow-[0_0_25px_rgba(0,255,170,0.6)] transition-all">
                  <Dices className="w-4 h-4 text-black" />
                </div>
                <span className="font-display font-bold text-xl tracking-tight hidden sm:block">
                  Pool<span className="text-primary neon-text-primary">Casino</span>
                </span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-1 items-center">
              {/* Dashboard — first link */}
              {navLinks.slice(0, 1).map((link) => {
                const isActive = location === link.href;
                return (
                  <Link key={link.href} href={link.href} title={(link as any).title}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer ${isActive ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}>
                    {link.icon}{link.label}
                  </Link>
                );
              })}

              {/* Games dropdown */}
              <div ref={gamesDropdownRef} className="relative">
                <button
                  onClick={() => setGamesDropdownOpen(o => !o)}
                  className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isGamesActive ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Dices className="w-4 h-4" />
                  Games
                  <span className={`text-xs transition-transform duration-200 ${gamesDropdownOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                <AnimatePresence>
                  {gamesDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 w-52 rounded-xl bg-card/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden z-50"
                    >
                      {[
                        { href: "/games",      label: "All Games",             icon: <Dices className="w-3.5 h-3.5" />,          sub: "20 games available" },
                        { href: "/multiplayer",label: "Multiplayer",            icon: <span className="text-sm">👥</span>,         sub: "PvP War & Higher/Lower" },
                        { href: "/badges",     label: "Badges & Challenges",    icon: <span className="text-sm">🏆</span>,         sub: "Earn badges" },
                        { href: "/casinos",    label: "Player-Owned Casinos",   icon: <span className="text-sm">🏦</span>,         sub: "Own & operate casinos" },
                      ].map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setGamesDropdownOpen(false)}
                          className={`flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${location === item.href || (item.href !== "/games" && location.startsWith(item.href)) ? "bg-white/5" : ""}`}>
                          <span className="mt-0.5 text-primary">{item.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-white leading-none">{item.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{item.sub}</p>
                          </div>
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Remaining nav links */}
              {navLinks.slice(1).map((link) => {
                const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
                return (
                  <Link key={link.href} href={link.href} title={(link as any).title}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer ${isActive ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}>
                    {link.icon}
                    {link.label}
                    {link.href === "/chat" && totalNotifs > 0 && (
                      <span className="bg-primary text-black text-[10px] font-bold rounded-full px-1.5 py-px min-w-[18px] text-center leading-none">
                        {totalNotifs > 99 ? "99+" : totalNotifs}
                      </span>
                    )}
                    {(link as any).badge && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-px min-w-[18px] text-center leading-none">
                        {(link as any).badge > 99 ? "99+" : (link as any).badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right side: Pool + Request Money + Notifications + User */}
            <div className="flex items-center gap-2">
              {/* Live Pool Balance */}
              {pool && (
                <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-accent/30 bg-black/40 text-accent">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                  Pool: {formatCurrency(pool.totalAmount)}
                </div>
              )}

              {/* Request Money Button */}
              {user && !isGuest && (
                <button
                  onClick={() => setShowMoneyModal(true)}
                  className="hidden md:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-all"
                >
                  <Banknote className="w-3.5 h-3.5" /> Need money?
                </button>
              )}

              {/* Notifications Bell */}
              {user && !isGuest && (
                <Link href="/notifications">
                  <button className="relative p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
                    <Bell className="w-4 h-4" />
                    {totalNotifs > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-primary text-black text-[9px] font-bold rounded-full px-1 min-w-[16px] text-center leading-4">
                        {totalNotifs > 99 ? "99+" : totalNotifs}
                      </span>
                    )}
                  </button>
                </Link>
              )}

              {/* User Area */}
              <div className="flex items-center gap-2">
                {!isLoading && user && !isGuest ? (
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 shadow-inner">
                      <Coins className="w-4 h-4 text-primary" />
                      <span className="font-mono font-semibold text-primary tracking-tight">
                        {formatCurrency(user.balance)}
                      </span>
                    </div>
                    <Link href="/profile">
                      <Button variant="ghost" size="icon" className="rounded-full bg-white/5 border border-white/10 overflow-hidden p-0 w-8 h-8">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center text-black text-xs font-bold">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="hidden sm:inline-flex text-muted-foreground hover:text-destructive">
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                ) : !isLoading && user && isGuest ? (
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 shadow-inner">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="font-mono font-semibold text-yellow-400 tracking-tight">
                        {formatCurrency(user.balance)}
                      </span>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                      Guest
                    </span>
                    <Link href="/register">
                      <Button variant="default" size="sm" className="shadow-[0_0_15px_rgba(0,255,170,0.3)] gap-1.5">
                        <UserPlus className="w-3.5 h-3.5" /> Create Account
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Log in</Button>
                    </Link>
                  </div>
                ) : !isLoading ? (
                  <div className="flex items-center gap-2">
                    <Link href="/login">
                      <Button variant="ghost" className="hidden sm:inline-flex">Log in</Button>
                    </Link>
                    <Link href="/register">
                      <Button variant="default" className="shadow-[0_0_15px_rgba(0,255,170,0.3)]">Sign up</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="w-24 h-8 animate-pulse bg-white/5 rounded-full" />
                )}

                {/* Mobile Menu Button */}
                <div className="md:hidden flex items-center">
                  <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-b border-white/5 bg-card/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-4 pt-2 pb-4 space-y-1">
              {user && (
                <div className="px-3 py-3 mb-2 flex items-center justify-between bg-black/40 rounded-xl border border-white/5">
                  <span className="text-sm text-muted-foreground">Balance</span>
                  <span className="font-mono font-bold text-primary">{formatCurrency(user.balance)}</span>
                </div>
              )}
              {/* Dashboard */}
              {navLinks.slice(0, 1).map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-3 rounded-xl text-base font-medium ${location === link.href ? "bg-white/10 text-white" : "text-muted-foreground"}`}>
                  <div className="flex items-center gap-3">{link.icon}{link.label}</div>
                </Link>
              ))}
              {/* Games section */}
              <div className="pl-3 py-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">Games</div>
              {[
                { href: "/games",       label: "All Games",           icon: <Dices className="w-4 h-4" /> },
                { href: "/multiplayer", label: "Multiplayer",          icon: <span>👥</span> },
                { href: "/badges",      label: "Badges & Challenges",  icon: <span>🏆</span> },
                { href: "/casinos",     label: "Player-Owned Casinos", icon: <span>🏦</span> },
              ].map(link => (
                <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-3 rounded-xl text-sm font-medium ${location === link.href ? "bg-white/10 text-white" : "text-muted-foreground"}`}>
                  <div className="flex items-center gap-3 pl-2">{link.icon}{link.label}</div>
                </Link>
              ))}
              {/* Remaining nav links */}
              {navLinks.slice(1).map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-3 rounded-xl text-base font-medium ${location === link.href ? "bg-white/10 text-white" : "text-muted-foreground"}`}>
                  <div className="flex items-center gap-3">
                    {link.icon}
                    {link.label}
                    {link.href === "/chat" && totalNotifs > 0 && (
                      <span className="bg-primary text-black text-[10px] font-bold rounded-full px-1.5">{totalNotifs}</span>
                    )}
                  </div>
                </Link>
              ))}
              {user && !isGuest && (
                <button onClick={() => { setShowMoneyModal(true); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-3 rounded-xl text-base font-medium text-primary">
                  <div className="flex items-center gap-3">
                    <Banknote className="w-4 h-4" /> Need money?
                  </div>
                </button>
              )}
              {!isLoading && (!user || isGuest) && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  {isGuest && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <span className="text-sm text-yellow-400 font-medium">Playing as Guest</span>
                      <span className="text-xs text-yellow-400/70">Progress saves on account</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">Log in</Button>
                    </Link>
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full">Sign up</Button>
                    </Link>
                  </div>
                </div>
              )}
              {user && !isGuest && (
                <Button variant="ghost" className="w-full mt-2 justify-start text-destructive"
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
                  <LogOut className="w-4 h-4 mr-2" /> Log out
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request Money Modal */}
      <AnimatePresence>
        {showMoneyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowMoneyModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 bg-card border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-primary">Request More Money</h2>
                  <p className="text-sm text-muted-foreground mt-1">Ask an admin to top up your balance.</p>
                </div>
                <button onClick={() => setShowMoneyModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input type="number" min="1" max="10000000" value={moneyAmount}
                      onChange={e => setMoneyAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-primary/50 font-mono outline-none text-sm" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[10000, 50000, 100000, 500000].map(a => (
                      <button key={a} onClick={() => setMoneyAmount(a.toString())}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${moneyAmount === a.toString() ? "bg-primary/20 border-primary/50 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
                        ${(a / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">Message (optional)</label>
                  <input type="text" value={moneyMsg} onChange={e => setMoneyMsg(e.target.value)}
                    placeholder="Tell the admin why you need it..."
                    maxLength={200}
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-primary/50 outline-none text-sm" />
                </div>
              </div>
              <Button onClick={handleRequestMoney} disabled={moneyPending} className="w-full bg-primary hover:bg-primary/80 text-black font-bold gap-2">
                <Banknote className="w-4 h-4" />
                {moneyPending ? "Sending..." : "Send Request"}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Appeal Ban Modal */}
      <AnimatePresence>
        {showAppealModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAppealModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 bg-card border border-red-800/40 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-red-400 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Appeal Ban</h2>
                  <p className="text-sm text-muted-foreground mt-1">Explain why you believe this action was unjust. An admin will review your appeal.</p>
                </div>
                <button onClick={() => setShowAppealModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Your Appeal</label>
                <textarea
                  value={appealMsg}
                  onChange={e => setAppealMsg(e.target.value)}
                  placeholder="Explain your situation in detail..."
                  rows={5}
                  maxLength={2000}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-red-500/50 outline-none text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{appealMsg.length}/2000</p>
              </div>
              <Button onClick={handleAppeal} disabled={appealPending || appealMsg.trim().length < 10} className="w-full bg-red-800 hover:bg-red-700 text-white font-bold gap-2">
                <AlertTriangle className="w-4 h-4" />
                {appealPending ? "Submitting..." : "Submit Appeal"}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ban/Suspend Status Banners */}
      {isBanned && (
        <div className="bg-red-950/80 border-b border-red-800/60 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-red-300">
              <Ban className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                {u.permanentlyBanned ? "Your account has been permanently banned from playing games." : `Your account is banned from playing games until ${new Date(u.bannedUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`}
              </span>
            </div>
            <button
              onClick={() => setShowAppealModal(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-red-800/50 border border-red-700/50 text-red-300 hover:bg-red-700/50 transition-colors flex-shrink-0"
            >
              Appeal Ban
            </button>
          </div>
        </div>
      )}
      {isSuspended && (
        <div className="bg-yellow-950/80 border-b border-yellow-800/60 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-yellow-300">
            <MicOff className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">
              Your chat privileges are suspended until {new Date(u.suspendedUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
            </span>
          </div>
        </div>
      )}

      <main className={`flex-1 w-full ${isChat ? "overflow-hidden min-h-0 flex flex-col" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}`}>
        {children}
      </main>

      {/* Footer — hidden on /chat so it never overlaps the input */}
      {!isChat && <footer className="border-t border-white/5 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-6 h-6 rounded border border-white/20 flex items-center justify-center">
              <Dices className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-medium">PoolCasino © 2026</span>
          </div>
          <p className="text-xs text-muted-foreground text-center md:text-right max-w-md">
            This is a simulator using fake money. No real money gambling occurs on this site.
          </p>
          <a
            href="https://mail.google.com/mail/?view=cm&to=hudsoduk@gmail.com&su=PoolCasino+Support+%2F+Feedback"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-white/10 text-muted-foreground hover:text-white hover:border-white/30 transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Support &amp; Feedback
          </a>
        </div>
      </footer>}
    </div>
  );
}
