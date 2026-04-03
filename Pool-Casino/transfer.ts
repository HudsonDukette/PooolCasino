import { Router, type IRouter } from "express";
import { db, usersTable, poolTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { TransferBody, TransferResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/transfer", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = TransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { toUsername, amount } = parsed.data;

  const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!sender) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const senderBalance = parseFloat(sender.balance);
  if (senderBalance < amount) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  if (sender.username.toLowerCase() === toUsername.toLowerCase()) {
    res.status(400).json({ error: "Cannot transfer to yourself" });
    return;
  }

  const [recipient] = await db
    .select()
    .from(usersTable)
    .where(ilike(usersTable.username, toUsername))
    .limit(1);

  if (!recipient) {
    res.status(404).json({ error: `Player "${toUsername}" not found` });
    return;
  }

  const newSenderBalance = senderBalance - amount;
  const newRecipientBalance = parseFloat(recipient.balance) + amount;

  await Promise.all([
    db.update(usersTable)
      .set({ balance: newSenderBalance.toFixed(2) })
      .where(eq(usersTable.id, sender.id)),
    db.update(usersTable)
      .set({ balance: newRecipientBalance.toFixed(2) })
      .where(eq(usersTable.id, recipient.id)),
  ]);

  res.json(
    TransferResponse.parse({
      message: `Sent ${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })} to ${recipient.username}`,
      newBalance: newSenderBalance,
    }),
  );
});

export default router;
