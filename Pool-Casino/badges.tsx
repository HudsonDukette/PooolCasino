import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${url}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error("Request failed");
  return r.json();
}

interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  badgeType: string;
  requirementType: string;
  requirementValue: number;
  requirementGame: string | null;
}

interface UserBadge {
  badgeId: number;
  earnedAt: string;
  claimed: boolean;
  progress: number;
}

interface Challenge {
  id: number;
  month: string;
  name: string;
  description: string;
  icon: string;
  requirementType: string;
  requirementValue: number;
}

interface ChallengeProgress {
  challengeId: number;
  progress: number;
  claimed: boolean;
}

export default function Badges() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const [tab, setTab] = useState<"badges" | "monthly">("badges");

  const { data: badgesData, refetch: refetchBadges } = useQuery({
    queryKey: ["badges"],
    queryFn: () => apiFetch("api/badges"),
    staleTime: 60000,
  });

  const { data: monthlyData, refetch: refetchMonthly } = useQuery({
    queryKey: ["badges-monthly"],
    queryFn: () => apiFetch("api/badges/monthly"),
    staleTime: 60000,
  });

  const badges: Badge[] = badgesData?.badges ?? [];
  const userBadges: UserBadge[] = badgesData?.userBadges ?? [];
  const challenges: Challenge[] = monthlyData?.challenges ?? [];
  const challengeProgress: ChallengeProgress[] = monthlyData?.progress ?? [];

  const earnedBadgeIds = new Set(userBadges.map(ub => ub.badgeId));
  const earnedBadgeMap = new Map(userBadges.map(ub => [ub.badgeId, ub]));
  const challengeMap = new Map(challengeProgress.map(cp => [cp.challengeId, cp]));

  const handleClaimBadge = async (badgeId: number) => {
    await apiFetch(`api/badges/claim/${badgeId}`, { method: "POST" });
    refetchBadges();
  };

  const handleClaimChallenge = async (challengeId: number) => {
    await apiFetch(`api/badges/monthly/claim/${challengeId}`, { method: "POST" });
    refetchMonthly();
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
        <h1 className="text-3xl font-black text-white">🏆 Badges & Challenges</h1>
        <p className="text-muted-foreground">Earn badges by playing games and completing challenges</p>
        {user && (
          <div className="inline-flex items-center gap-2 text-sm text-primary">
            <span>You have</span>
            <span className="font-bold">{userBadges.length}</span>
            <span>of {badges.length} badges</span>
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 bg-black/20 p-1 rounded-xl border border-white/5 w-fit mx-auto">
        {(["badges", "monthly"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? "bg-primary text-black" : "text-muted-foreground hover:text-white"
            }`}>
            {t === "monthly" ? "Monthly Challenges" : "Badges"}
          </button>
        ))}
      </div>

      {tab === "badges" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map(badge => {
            const ub = earnedBadgeMap.get(badge.id);
            const isEarned = earnedBadgeIds.has(badge.id);
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative p-5 rounded-2xl border transition-all ${
                  isEarned
                    ? "bg-card border-primary/30 shadow-[0_0_15px_rgba(0,255,170,0.1)]"
                    : "bg-black/20 border-white/5 opacity-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`text-3xl ${!isEarned ? "grayscale" : ""}`}>{badge.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm leading-tight">{badge.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{badge.description}</p>
                  </div>
                  {isEarned && (
                    <span className="text-xs text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium whitespace-nowrap">
                      Earned ✓
                    </span>
                  )}
                </div>
                {!isEarned && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/5 rounded-full">
                      <div className="h-1 bg-white/20 rounded-full" style={{ width: "0%" }} />
                    </div>
                    <span className="text-xs text-muted-foreground">Locked</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {tab === "monthly" && (
        <div className="space-y-4">
          {challenges.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No challenges this month yet.</div>
          )}
          {challenges.map(challenge => {
            const prog = challengeMap.get(challenge.id);
            const progress = prog?.progress ?? 0;
            const pct = Math.min(100, Math.round((progress / challenge.requirementValue) * 100));
            const completed = progress >= challenge.requirementValue;
            const claimed = prog?.claimed ?? false;

            return (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl border ${
                  completed && !claimed
                    ? "bg-card border-primary/40 shadow-[0_0_20px_rgba(0,255,170,0.15)]"
                    : claimed
                    ? "bg-black/20 border-green-500/20"
                    : "bg-black/20 border-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{challenge.icon}</div>
                    <div>
                      <h3 className="font-semibold text-white">{challenge.name}</h3>
                      <p className="text-sm text-muted-foreground">{challenge.description}</p>
                    </div>
                  </div>
                  {claimed ? (
                    <span className="text-xs text-green-400 bg-green-500/10 rounded-full px-3 py-1 font-medium whitespace-nowrap">Claimed ✓</span>
                  ) : completed && user ? (
                    <button
                      onClick={() => handleClaimChallenge(challenge.id)}
                      className="text-xs bg-primary text-black rounded-full px-3 py-1 font-semibold whitespace-nowrap hover:bg-primary/80 transition-colors"
                    >
                      Claim Reward
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress.toLocaleString()} / {challenge.requirementValue.toLocaleString()}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`h-full rounded-full ${completed ? "bg-primary" : "bg-white/30"}`}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
