import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { RegisterBody, LoginBody, RegisterResponse, LoginResponse, GetMeResponse, LogoutResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function makeUniqueReferralCode(): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = generateReferralCode();
    const existing = await db.select().from(usersTable).where(eq(usersTable.referralCode, code)).limit(1);
    if (existing.length === 0) return code;
  }
  return generateReferralCode() + Date.now().toString(36).slice(-4).toUpperCase();
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    balance: parseFloat(user.balance),
    isAdmin: user.isAdmin,
    isOwner: user.isOwner,
    isGuest: user.isGuest,
    isCrazyGamesLinked: user.isCrazyGamesLinked,
    referralCode: user.referralCode ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
    suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
    bannedUntil: user.bannedUntil?.toISOString() ?? null,
    permanentlyBanned: user.permanentlyBanned,
    banReason: user.banReason ?? null,
  };
}

async function mergeGuestIntoUser(guestId: number, userId: number): Promise<void> {
  const [guest] = await db.select().from(usersTable).where(eq(usersTable.id, guestId)).limit(1);
  if (!guest || !guest.isGuest) return;
  const earned = Math.max(0, parseFloat(guest.balance) - 10000);
  if (earned > 0 || parseInt(guest.gamesPlayed) > 0) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return;
    const newBalance = parseFloat(user.balance) + earned;
    const newGamesPlayed = parseInt(user.gamesPlayed) + parseInt(guest.gamesPlayed);
    const newTotalWins = parseInt(user.totalWins) + parseInt(guest.totalWins);
    const newTotalLosses = parseInt(user.totalLosses) + parseInt(guest.totalLosses);
    const newTotalProfit = parseFloat(user.totalProfit) + parseFloat(guest.totalProfit);
    const newBiggestWin = Math.max(parseFloat(user.biggestWin), parseFloat(guest.biggestWin));
    const newBiggestBet = Math.max(parseFloat(user.biggestBet), parseFloat(guest.biggestBet));
    await db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      gamesPlayed: newGamesPlayed.toString(),
      totalWins: newTotalWins.toString(),
      totalLosses: newTotalLosses.toString(),
      totalProfit: newTotalProfit.toFixed(2),
      biggestWin: newBiggestWin.toFixed(2),
      biggestBet: newBiggestBet.toFixed(2),
    }).where(eq(usersTable.id, userId));
  }
  await db.delete(usersTable).where(eq(usersTable.id, guestId));
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, email, referralCode } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  let referrerId: number | null = null;
  let bonusBalance = 10000;

  if (referralCode) {
    const referrer = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode.toUpperCase())).limit(1);
    if (referrer.length > 0) {
      referrerId = referrer[0].id;
      bonusBalance += 20000;
      const referrerNewBalance = parseFloat(referrer[0].balance) + 10000;
      await db.update(usersTable).set({ balance: referrerNewBalance.toFixed(2) }).where(eq(usersTable.id, referrerId));
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newReferralCode = await makeUniqueReferralCode();

  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      passwordHash,
      email: email ?? null,
      balance: bonusBalance.toFixed(2),
      referralCode: newReferralCode,
      referredBy: referrerId ?? undefined,
    })
    .returning();

  const prevGuestId = req.session.userId;
  req.session.userId = user.id;
  if (prevGuestId && prevGuestId !== user.id) {
    await mergeGuestIntoUser(prevGuestId, user.id).catch(() => {});
  }

  const [merged] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

  const response = RegisterResponse.parse({
    user: formatUser(merged ?? user),
    message: referrerId
      ? `Registration successful! You received a $20,000 referral bonus!`
      : "Registration successful",
  });

  res.json(response);
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const prevGuestId = req.session.userId;
  req.session.userId = user.id;
  if (prevGuestId && prevGuestId !== user.id) {
    await mergeGuestIntoUser(prevGuestId, user.id).catch(() => {});
  }

  const [merged] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

  const response = LoginResponse.parse({
    user: formatUser(merged ?? user),
    message: "Login successful",
  });

  res.json(response);
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    res.clearCookie("connect.sid");
    if (err) {
      res.status(500).json({ error: "Logout failed" });
    } else {
      res.json(LogoutResponse.parse({ message: "Logged out" }));
    }
  });
});

let cachedCGPublicKey: string | null = null;
let cachedCGPublicKeyAt = 0;

async function getCrazyGamesPublicKey(): Promise<string> {
  const now = Date.now();
  if (cachedCGPublicKey && now - cachedCGPublicKeyAt < 3_600_000) {
    return cachedCGPublicKey;
  }
  const res = await fetch("https://sdk.crazygames.com/publicKey.json");
  if (!res.ok) throw new Error("Failed to fetch CrazyGames public key");
  const data = await res.json() as { publicKey: string };
  cachedCGPublicKey = data.publicKey;
  cachedCGPublicKeyAt = now;
  return cachedCGPublicKey;
}

router.post("/auth/crazygames", async (req, res): Promise<void> => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  let payload: { userId: string; username: string; profilePictureUrl?: string };
  try {
    const publicKey = await getCrazyGamesPublicKey();
    payload = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as typeof payload;
  } catch (err) {
    res.status(401).json({ error: "Invalid CrazyGames token" });
    return;
  }

  const { userId: cgUserId, username: cgUsername, profilePictureUrl } = payload;

  let [user] = await db.select().from(usersTable).where(eq(usersTable.crazyGamesUserId, cgUserId)).limit(1);

  if (!user) {
    let baseUsername = cgUsername || `cg_${cgUserId.slice(0, 8)}`;
    let finalUsername = baseUsername;
    let attempt = 0;
    while (true) {
      const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, finalUsername)).limit(1);
      if (existing.length === 0) break;
      attempt++;
      finalUsername = `${baseUsername}_${attempt}`;
    }

    const dummyHash = await bcrypt.hash(`cg-${cgUserId}-${Date.now()}`, 10);
    const newReferralCode = await makeUniqueReferralCode();

    [user] = await db
      .insert(usersTable)
      .values({
        username: finalUsername,
        passwordHash: dummyHash,
        avatarUrl: profilePictureUrl ?? null,
        referralCode: newReferralCode,
        crazyGamesUserId: cgUserId,
        isCrazyGamesLinked: true,
      })
      .returning();
  } else {
    const updates: Record<string, unknown> = { isCrazyGamesLinked: true };
    if (profilePictureUrl && user.avatarUrl !== profilePictureUrl) updates.avatarUrl = profilePictureUrl;
    await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
    user = { ...user, ...updates };
  }

  const prevGuestId = req.session.userId;
  req.session.userId = user.id;
  if (prevGuestId && prevGuestId !== user.id) {
    await mergeGuestIntoUser(prevGuestId, user.id).catch(() => {});
  }

  const [merged] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  res.json({ user: formatUser(merged ?? user), message: "Logged in via CrazyGames" });
});

router.post("/auth/guest/init", async (req, res): Promise<void> => {
  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 8) {
    res.status(400).json({ error: "Invalid deviceId" });
    return;
  }

  if (req.session.userId) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
    if (existing && !existing.isGuest) {
      res.json({ user: formatUser(existing), isGuest: false });
      return;
    }
  }

  let [guest] = await db.select().from(usersTable).where(eq(usersTable.deviceId, deviceId)).limit(1);

  if (!guest) {
    const guestNum = Math.floor(Math.random() * 100000);
    const guestUsername = `Guest_${guestNum}`;
    const dummyHash = await bcrypt.hash(`guest-${deviceId}-${Date.now()}`, 8);

    [guest] = await db
      .insert(usersTable)
      .values({
        username: guestUsername,
        passwordHash: dummyHash,
        deviceId,
        isGuest: true,
        balance: "10000.00",
      })
      .returning();
  }

  req.session.userId = guest.id;
  res.json({ user: formatUser(guest), isGuest: true });
});

router.post("/auth/crazygames/link", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!currentUser || currentUser.isGuest) {
    res.status(403).json({ error: "Must be logged in to a real account to link CrazyGames" });
    return;
  }

  if (currentUser.isCrazyGamesLinked && currentUser.crazyGamesUserId) {
    res.status(400).json({ error: "CrazyGames account already linked" });
    return;
  }

  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "CrazyGames token required" });
    return;
  }

  const publicKeyUrl = "https://sdk.crazygames.com/publicKey.json";
  let publicKeyPem: string;
  try {
    const pkRes = await fetch(publicKeyUrl);
    if (!pkRes.ok) throw new Error("Failed to fetch CG public key");
    const pkData = await pkRes.json() as { publicKey: string };
    publicKeyPem = pkData.publicKey;
  } catch {
    res.status(502).json({ error: "Could not verify CrazyGames token" });
    return;
  }

  let payload: { userId: string; username?: string; profilePictureUrl?: string };
  try {
    const { createPublicKey, createVerify } = await import("crypto");
    const publicKey = createPublicKey(publicKeyPem);
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) throw new Error("Invalid JWT");
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const verify = createVerify("sha256");
    verify.update(signingInput);
    if (!verify.verify(publicKey, signature)) throw new Error("Invalid JWT signature");
    payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    res.status(401).json({ error: "Invalid CrazyGames token" });
    return;
  }

  const cgUserId = payload.userId;
  if (!cgUserId) {
    res.status(400).json({ error: "No user ID in CrazyGames token" });
    return;
  }

  const [existingLinked] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.crazyGamesUserId, cgUserId))
    .limit(1);

  if (existingLinked && existingLinked.id !== userId) {
    res.status(409).json({ error: "This CrazyGames account is already linked to another user" });
    return;
  }

  await db.update(usersTable).set({
    crazyGamesUserId: cgUserId,
    isCrazyGamesLinked: true,
    avatarUrl: payload.profilePictureUrl ?? currentUser.avatarUrl,
  }).where(eq(usersTable.id, userId));

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  res.json({ user: formatUser(updated!), message: "CrazyGames account linked successfully" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(GetMeResponse.parse(formatUser(user)));
});

export default router;
