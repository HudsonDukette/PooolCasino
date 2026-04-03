import { Router, type IRouter } from "express";
import { db, usersTable, poolTable, settingsTable, chatMessagesTable, moneyRequestsTable, reportsTable, banAppealsTable, casinosTable, casinoGamesOwnedTable, casinoBetsTable, casinoTransactionsTable, casinoDrinksTable, userDrinksTable, monthlyTaxLogsTable, casinoGameOddsTable, betsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { sendPushToUser } from "../lib/push";
import {
  AdminRefillPoolBody,
  AdminRefillPoolResponse,
  AdminRefillPlayerBody,
  AdminRefillPlayerResponse,
  AdminListPlayersResponse,
  AdminGetSettingsResponse,
  AdminUpdateSettingsBody,
  AdminUpdateSettingsResponse,
  AdminResetAllBalancesBody,
  AdminResetAllBalancesResponse,
  AdminSeizeBody,
  AdminSeizeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || !user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

async function getSetting(key: string, defaultValue: number): Promise<number> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (!row) return defaultValue;
  return parseFloat(row.value) || defaultValue;
}

async function upsertSetting(key: string, value: number): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value: value.toString() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: value.toString() } });
}

router.post("/admin/refill-pool", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const parsed = AdminRefillPoolBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount } = parsed.data;

  const [pool] = await db.select().from(poolTable).limit(1);
  if (!pool) {
    res.status(500).json({ error: "Pool not found" });
    return;
  }

  const currentAmount = parseFloat(pool.totalAmount);
  const newPoolAmount = currentAmount + amount;

  await db.update(poolTable).set({
    totalAmount: newPoolAmount.toFixed(2),
  }).where(eq(poolTable.id, pool.id));

  res.json(
    AdminRefillPoolResponse.parse({
      message: `Pool refilled by $${amount.toLocaleString()}`,
      newPoolAmount,
    }),
  );
});

router.post("/admin/refill-player", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const parsed = AdminRefillPlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId: targetUserId, amount } = parsed.data;

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
  if (!targetUser) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const currentBalance = parseFloat(targetUser.balance);
  const newBalance = currentBalance + amount;

  await db.update(usersTable).set({
    balance: newBalance.toFixed(2),
  }).where(eq(usersTable.id, targetUserId));

  res.json(
    AdminRefillPlayerResponse.parse({
      message: `Player ${targetUser.username} balance refilled by $${amount.toLocaleString()}`,
      newBalance,
    }),
  );
});

router.get("/admin/players", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const players = await db.select().from(usersTable).orderBy(usersTable.id);

  res.json({
    players: players.map((p) => ({
      id: p.id,
      username: p.username,
      balance: parseFloat(p.balance),
      isAdmin: p.isAdmin,
      gamesPlayed: parseInt(p.gamesPlayed),
      totalWins: parseInt(p.totalWins),
      totalLosses: parseInt(p.totalLosses),
      avatarUrl: p.avatarUrl ?? null,
      suspendedUntil: p.suspendedUntil?.toISOString() ?? null,
      bannedUntil: p.bannedUntil?.toISOString() ?? null,
      permanentlyBanned: p.permanentlyBanned,
    })),
  });
});

router.get("/admin/settings", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const usernameChangeCost = await getSetting("username_change_cost", 500);
  const avatarChangeCost = await getSetting("avatar_change_cost", 250);
  const [disabledGamesRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "disabled_games")).limit(1);
  const disabledGames: string[] = disabledGamesRow ? JSON.parse(disabledGamesRow.value) : [];

  res.json(
    AdminGetSettingsResponse.parse({ usernameChangeCost, avatarChangeCost, disabledGames }),
  );
});

router.post("/admin/settings", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const parsed = AdminUpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { usernameChangeCost, avatarChangeCost, disabledGames } = parsed.data;

  if (usernameChangeCost != null) await upsertSetting("username_change_cost", usernameChangeCost);
  if (avatarChangeCost != null) await upsertSetting("avatar_change_cost", avatarChangeCost);
  if (disabledGames != null) await upsertSetting("disabled_games", JSON.stringify(disabledGames));

  const finalUsernameCost = await getSetting("username_change_cost", 500);
  const finalAvatarCost = await getSetting("avatar_change_cost", 250);
  const [disabledGamesRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "disabled_games")).limit(1);
  const finalDisabledGames: string[] = disabledGamesRow ? JSON.parse(disabledGamesRow.value) : [];

  res.json(
    AdminUpdateSettingsResponse.parse({
      usernameChangeCost: finalUsernameCost,
      avatarChangeCost: finalAvatarCost,
      disabledGames: finalDisabledGames,
    }),
  );
});

router.post("/admin/reset-all-balances", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const parsed = AdminResetAllBalancesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const resetBalance = parsed.data.newBalance ?? 10000;

  const allUsers = await db.select({ id: usersTable.id, isAdmin: usersTable.isAdmin })
    .from(usersTable);

  const nonAdminUsers = allUsers.filter((u) => !u.isAdmin);

  await Promise.all(
    nonAdminUsers.map((u) =>
      db.update(usersTable)
        .set({ balance: resetBalance.toFixed(2) })
        .where(eq(usersTable.id, u.id))
    )
  );

  res.json(
    AdminResetAllBalancesResponse.parse({
      message: `Reset ${nonAdminUsers.length} player balance(s) to ${formatCurrency(resetBalance)}`,
      usersReset: nonAdminUsers.length,
    }),
  );
});

router.post("/admin/seize", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const parsed = AdminSeizeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fromUserId, amount, destination, toUserId } = parsed.data;

  const [victim] = await db.select().from(usersTable).where(eq(usersTable.id, fromUserId)).limit(1);
  if (!victim) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const victimBalance = parseFloat(victim.balance);
  const actualAmount = Math.min(amount, victimBalance);

  if (actualAmount <= 0) {
    res.status(400).json({ error: "Player has no balance to seize" });
    return;
  }

  const newVictimBalance = victimBalance - actualAmount;

  await db.update(usersTable)
    .set({ balance: newVictimBalance.toFixed(2) })
    .where(eq(usersTable.id, fromUserId));

  let targetDescription = "the pool";

  if (destination === "user" && toUserId) {
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, toUserId)).limit(1);
    if (!targetUser) {
      res.status(404).json({ error: "Target user not found" });
      return;
    }
    const newTargetBalance = parseFloat(targetUser.balance) + actualAmount;
    await db.update(usersTable)
      .set({ balance: newTargetBalance.toFixed(2) })
      .where(eq(usersTable.id, toUserId));
    targetDescription = `@${targetUser.username}`;
  } else {
    const [pool] = await db.select().from(poolTable).limit(1);
    if (pool) {
      const newPoolAmount = parseFloat(pool.totalAmount) + actualAmount;
      await db.update(poolTable)
        .set({ totalAmount: newPoolAmount.toFixed(2) })
        .where(eq(poolTable.id, pool.id));
    }
  }

  res.json(
    AdminSeizeResponse.parse({
      message: `Seized ${formatCurrency(actualAmount)} from ${victim.username} → ${targetDescription}`,
      amountSeized: actualAmount,
      newVictimBalance: newVictimBalance,
    }),
  );
});

router.post("/admin/force-reload", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const ts = Date.now();
  await db
    .insert(settingsTable)
    .values({ key: "force_reload_at", value: ts.toString() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: ts.toString() } });

  res.json({ message: "Force reload signal sent", timestamp: ts });
});

router.post("/admin/broadcast", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ error: "Message required" }); return; }

  await db.insert(chatMessagesTable).values({
    roomId: 1,
    userId: null,
    content: content.trim(),
    isAdminBroadcast: true,
  });

  res.json({ message: "Broadcast sent to General chat" });
});

router.get("/admin/money-requests", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const reqs = await db
    .select({
      id: moneyRequestsTable.id,
      userId: moneyRequestsTable.userId,
      amount: moneyRequestsTable.amount,
      message: moneyRequestsTable.message,
      status: moneyRequestsTable.status,
      createdAt: moneyRequestsTable.createdAt,
      username: usersTable.username,
    })
    .from(moneyRequestsTable)
    .leftJoin(usersTable, eq(usersTable.id, moneyRequestsTable.userId))
    .orderBy(moneyRequestsTable.createdAt);
  res.json({ requests: reqs });
});

router.post("/admin/user/:id/change-username", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const targetId = parseInt(req.params.id);
  const { newUsername } = req.body;
  if (!newUsername?.trim()) { res.status(400).json({ error: "newUsername required" }); return; }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, newUsername.trim())).limit(1);
  if (existing.length > 0 && existing[0].id !== targetId) { res.status(400).json({ error: "Username already taken" }); return; }

  await db.update(usersTable).set({ username: newUsername.trim() }).where(eq(usersTable.id, targetId));
  res.json({ ok: true, message: `Username changed to "${newUsername.trim()}"` });
});

router.post("/admin/user/:id/change-avatar", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const targetId = parseInt(req.params.id);
  const { avatarUrl } = req.body;
  await db.update(usersTable).set({ avatarUrl: avatarUrl ?? null }).where(eq(usersTable.id, targetId));
  res.json({ ok: true, message: avatarUrl ? "Avatar updated" : "Avatar removed" });
});

router.post("/admin/user/:id/suspend", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const targetId = parseInt(req.params.id);
  const hours = parseFloat(req.body.hours ?? 24);
  if (isNaN(hours) || hours <= 0) { res.status(400).json({ error: "hours must be positive" }); return; }
  const reason = req.body.reason ? String(req.body.reason).trim().slice(0, 500) : null;
  const until = new Date(Date.now() + hours * 3600 * 1000);
  await db.update(usersTable).set({ suspendedUntil: until, banReason: reason }).where(eq(usersTable.id, targetId));
  sendPushToUser(targetId, {
    title: "Account Notice",
    body: `Your chat privileges have been suspended for ${hours} hour(s).${reason ? ` Reason: ${reason}` : ""}`,
    url: "/notifications",
    tag: "account-suspension",
  }).catch(() => {});
  res.json({ ok: true, message: `User suspended for ${hours}h (until ${until.toISOString()})` });
});

router.post("/admin/user/:id/ban", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const targetId = parseInt(req.params.id);
  const hours = parseFloat(req.body.hours ?? 168);
  if (isNaN(hours) || hours <= 0) { res.status(400).json({ error: "hours must be positive" }); return; }
  const reason = req.body.reason ? String(req.body.reason).trim().slice(0, 500) : null;
  const until = new Date(Date.now() + hours * 3600 * 1000);
  await db.update(usersTable).set({ bannedUntil: until, banReason: reason }).where(eq(usersTable.id, targetId));
  sendPushToUser(targetId, {
    title: "Account Banned",
    body: `Your account has been banned for ${hours} hour(s). You may appeal this decision.${reason ? ` Reason: ${reason}` : ""}`,
    url: "/notifications",
    tag: "account-ban",
  }).catch(() => {});
  res.json({ ok: true, message: `User banned for ${hours}h (until ${until.toISOString()})` });
});

router.post("/admin/user/:id/perma-ban", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const targetId = parseInt(req.params.id);
  const reason = req.body.reason ? String(req.body.reason).trim().slice(0, 500) : null;
  await db.update(usersTable).set({ permanentlyBanned: true, banReason: reason }).where(eq(usersTable.id, targetId));
  sendPushToUser(targetId, {
    title: "Account Permanently Banned",
    body: `Your account has been permanently banned.${reason ? ` Reason: ${reason}` : ""} You may submit a ban appeal.`,
    url: "/notifications",
    tag: "account-ban",
  }).catch(() => {});
  res.json({ ok: true, message: "User permanently banned" });
});

router.post("/admin/user/:id/unban", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const targetId = parseInt(req.params.id);
  await db.update(usersTable).set({ suspendedUntil: null, bannedUntil: null, permanentlyBanned: false, banReason: null }).where(eq(usersTable.id, targetId));
  sendPushToUser(targetId, {
    title: "Account Notice",
    body: "Your account restrictions have been lifted. You can chat and play again.",
    url: "/",
    tag: "account-unban",
  }).catch(() => {});
  res.json({ ok: true, message: "User suspension/ban lifted" });
});

router.get("/admin/pending-count", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const [mrCount, reportCount, appealCount] = await Promise.all([
    db.select({ count: sql<string>`count(*)` }).from(moneyRequestsTable).where(eq(moneyRequestsTable.status, "pending")),
    db.select({ count: sql<string>`count(*)` }).from(reportsTable).where(eq(reportsTable.status, "pending")),
    db.select({ count: sql<string>`count(*)` }).from(banAppealsTable).where(eq(banAppealsTable.status, "pending")),
  ]);
  const count = parseInt(mrCount[0]?.count ?? "0") + parseInt(reportCount[0]?.count ?? "0") + parseInt(appealCount[0]?.count ?? "0");
  res.json({ count });
});

router.get("/admin/appeals", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const appeals = await db
    .select({
      id: banAppealsTable.id,
      userId: banAppealsTable.userId,
      message: banAppealsTable.message,
      status: banAppealsTable.status,
      createdAt: banAppealsTable.createdAt,
      reviewedAt: banAppealsTable.reviewedAt,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      bannedUntil: usersTable.bannedUntil,
      permanentlyBanned: usersTable.permanentlyBanned,
    })
    .from(banAppealsTable)
    .leftJoin(usersTable, eq(banAppealsTable.userId, usersTable.id))
    .orderBy(banAppealsTable.createdAt);
  res.json({ appeals });
});

router.post("/admin/appeals/:id/status", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const appealId = parseInt(req.params.id);
  const { status } = req.body;
  if (!["approved", "denied"].includes(status)) { res.status(400).json({ error: "status must be approved or denied" }); return; }
  const adminId = req.session.userId;
  const [appeal] = await db.update(banAppealsTable)
    .set({ status, reviewedAt: new Date(), reviewedBy: adminId })
    .where(eq(banAppealsTable.id, appealId))
    .returning();
  if (!appeal) { res.status(404).json({ error: "Appeal not found" }); return; }
  if (status === "approved") {
    await db.update(usersTable).set({ suspendedUntil: null, bannedUntil: null, permanentlyBanned: false })
      .where(eq(usersTable.id, appeal.userId));
    sendPushToUser(appeal.userId, {
      title: "Appeal Approved",
      body: "Your ban appeal has been approved. Your account restrictions have been lifted.",
      url: "/",
      tag: "appeal-approved",
    }).catch(() => {});
  } else {
    sendPushToUser(appeal.userId, {
      title: "Appeal Denied",
      body: "Your ban appeal has been reviewed and denied. Contact support if you have questions.",
      url: "/profile",
      tag: "appeal-denied",
    }).catch(() => {});
  }
  res.json({ ok: true, appeal });
});

router.post("/admin/user/:id/promote", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const targetId = parseInt(req.params.id);
  const [target] = await db.select({ id: usersTable.id, isAdmin: usersTable.isAdmin, username: usersTable.username })
    .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.isAdmin) { res.status(400).json({ error: "User is already an admin" }); return; }
  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, targetId));
  await sendPushToUser(targetId, {
    title: "You've been promoted!",
    body: "You now have admin privileges on PoolCasino.",
    tag: "account-promote",
  });
  res.json({ ok: true, message: `${target.username} has been promoted to admin` });
});

router.delete("/admin/user/:id", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const targetId = parseInt(req.params.id);
  const [target] = await db.select({ id: usersTable.id, isAdmin: usersTable.isAdmin, username: usersTable.username })
    .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.isAdmin) { res.status(403).json({ error: "Cannot delete admin accounts" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, targetId));
  res.json({ ok: true, message: `User ${target.username} deleted` });
});

router.delete("/admin/guests", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const deleted = await db.delete(usersTable).where(eq(usersTable.isGuest, true)).returning({ id: usersTable.id });
  const count = deleted.length;
  res.json({ ok: true, count, message: `Deleted ${count} guest account${count !== 1 ? "s" : ""}` });
});

// ─── Admin: casino management ─────────────────────────────────────────────────
router.get("/admin/casinos", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const casinos = await db
    .select({
      id: casinosTable.id,
      name: casinosTable.name,
      emoji: casinosTable.emoji,
      bankroll: casinosTable.bankroll,
      purchasePrice: casinosTable.purchasePrice,
      isPaused: casinosTable.isPaused,
      insolvencyWinnerId: casinosTable.insolvencyWinnerId,
      ownerId: casinosTable.ownerId,
      ownerUsername: usersTable.username,
      createdAt: casinosTable.createdAt,
    })
    .from(casinosTable)
    .leftJoin(usersTable, eq(casinosTable.ownerId, usersTable.id))
    .orderBy(casinosTable.createdAt);
  res.json({ casinos });
});

async function adminDeleteCasino(casinoId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(userDrinksTable).where(eq(userDrinksTable.casinoId, casinoId));
    await tx.delete(casinoGameOddsTable).where(eq(casinoGameOddsTable.casinoId, casinoId));
    await tx.delete(casinoTransactionsTable).where(eq(casinoTransactionsTable.casinoId, casinoId));
    await tx.delete(casinoBetsTable).where(eq(casinoBetsTable.casinoId, casinoId));
    await tx.delete(casinoGamesOwnedTable).where(eq(casinoGamesOwnedTable.casinoId, casinoId));
    await tx.delete(monthlyTaxLogsTable).where(eq(monthlyTaxLogsTable.casinoId, casinoId));
    await tx.delete(casinoDrinksTable).where(eq(casinoDrinksTable.casinoId, casinoId));
    await tx.delete(casinosTable).where(eq(casinosTable.id, casinoId));
  });
}

router.post("/admin/casinos/:id/sell", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const casinoId = parseInt(req.params.id);
  const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }
  const purchasePrice = parseFloat(casino.purchasePrice ?? "100000000");
  const refund = Math.floor(purchasePrice * 0.10);
  await db.transaction(async (tx) => {
    if (refund > 0) {
      const [owner] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, casino.ownerId)).limit(1);
      if (owner) {
        await tx.update(usersTable).set({ balance: (parseFloat(owner.balance) + refund).toFixed(2) }).where(eq(usersTable.id, casino.ownerId));
      }
    }
    await tx.delete(userDrinksTable).where(eq(userDrinksTable.casinoId, casinoId));
    await tx.delete(casinoGameOddsTable).where(eq(casinoGameOddsTable.casinoId, casinoId));
    await tx.delete(casinoTransactionsTable).where(eq(casinoTransactionsTable.casinoId, casinoId));
    await tx.delete(casinoBetsTable).where(eq(casinoBetsTable.casinoId, casinoId));
    await tx.delete(casinoGamesOwnedTable).where(eq(casinoGamesOwnedTable.casinoId, casinoId));
    await tx.delete(monthlyTaxLogsTable).where(eq(monthlyTaxLogsTable.casinoId, casinoId));
    await tx.delete(casinoDrinksTable).where(eq(casinoDrinksTable.casinoId, casinoId));
    await tx.delete(casinosTable).where(eq(casinosTable.id, casinoId));
  });
  res.json({ ok: true, refund, message: `Casino "${casino.name}" sold. Owner refunded ${refund.toLocaleString()} chips.` });
});

router.delete("/admin/casinos/:id", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;
  const casinoId = parseInt(req.params.id);
  const [casino] = await db.select({ id: casinosTable.id, name: casinosTable.name }).from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }
  await adminDeleteCasino(casinoId);
  res.json({ ok: true, message: `Casino "${casino.name}" deleted (no refund).` });
});

// ─── Owner-only reset endpoint ────────────────────────────────────────────────
async function requireOwner(req: any, res: any): Promise<boolean> {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  const [user] = await db.select({ isOwner: usersTable.isOwner }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user?.isOwner) { res.status(403).json({ error: "Owner access required" }); return false; }
  return true;
}

router.post("/admin/owner/reset", async (req, res): Promise<void> => {
  const isOwner = await requireOwner(req, res);
  if (!isOwner) return;
  const { startingBalance = 10000, resetPool = true, deleteCasinos = true, deleteStats = true } = req.body ?? {};

  await db.transaction(async (tx) => {
    if (deleteCasinos) {
      const allCasinos = await tx.select({ id: casinosTable.id }).from(casinosTable);
      for (const c of allCasinos) {
        await tx.delete(userDrinksTable).where(eq(userDrinksTable.casinoId, c.id));
        await tx.delete(casinoGameOddsTable).where(eq(casinoGameOddsTable.casinoId, c.id));
        await tx.delete(casinoTransactionsTable).where(eq(casinoTransactionsTable.casinoId, c.id));
        await tx.delete(casinoBetsTable).where(eq(casinoBetsTable.casinoId, c.id));
        await tx.delete(casinoGamesOwnedTable).where(eq(casinoGamesOwnedTable.casinoId, c.id));
        await tx.delete(monthlyTaxLogsTable).where(eq(monthlyTaxLogsTable.casinoId, c.id));
        await tx.delete(casinoDrinksTable).where(eq(casinoDrinksTable.casinoId, c.id));
        await tx.delete(casinosTable).where(eq(casinosTable.id, c.id));
      }
    }
    if (deleteStats) {
      await tx.delete(betsTable);
      if (!deleteCasinos) await tx.delete(casinoBetsTable);
      await tx.update(usersTable).set({
        totalProfit: "0.00", biggestWin: "0.00", biggestBet: "0.00",
        gamesPlayed: "0", winStreak: "0", currentStreak: "0",
        totalWins: "0", totalLosses: "0",
      });
    }
    await tx.update(usersTable).set({ balance: startingBalance.toFixed(2) }).where(eq(usersTable.isAdmin, false));
    if (resetPool) {
      await tx.update(poolTable).set({ totalAmount: "0.00" });
    }
  });

  res.json({ ok: true, message: `Server reset complete. Balances set to ${startingBalance.toLocaleString()}.` });
});

function formatCurrency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default router;
