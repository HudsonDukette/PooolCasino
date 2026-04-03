import { db, casinosTable, poolTable, casinoTransactionsTable, monthlyTaxLogsTable } from "@workspace/db";
import { eq, gt } from "drizzle-orm";
import { logger } from "./logger";
import cron from "node-cron";

const TAX_RATE = 0.10;

export async function runMonthlyTax(): Promise<void> {
  logger.info("Running monthly casino tax...");

  const [pool] = await db.select().from(poolTable).limit(1);
  if (!pool) { logger.warn("No pool found — skipping tax"); return; }

  const casinos = await db.select().from(casinosTable).where(gt(casinosTable.bankroll, "0"));

  let totalTaxCollected = 0;

  for (const casino of casinos) {
    const bankrollBefore = parseFloat(casino.bankroll);
    if (bankrollBefore <= 0) continue;

    const taxAmount = parseFloat((bankrollBefore * TAX_RATE).toFixed(2));
    const bankrollAfter = parseFloat((bankrollBefore - taxAmount).toFixed(2));

    await db.transaction(async (tx) => {
      await tx.update(casinosTable).set({
        bankroll: bankrollAfter.toFixed(2),
        updatedAt: new Date(),
      }).where(eq(casinosTable.id, casino.id));
      await tx.insert(monthlyTaxLogsTable).values({
        casinoId: casino.id,
        taxAmount: taxAmount.toFixed(2),
        bankrollBefore: bankrollBefore.toFixed(2),
        bankrollAfter: bankrollAfter.toFixed(2),
      });
      await tx.insert(casinoTransactionsTable).values({
        casinoId: casino.id,
        type: "tax",
        amount: taxAmount.toFixed(2),
        description: "Monthly 10% bankroll tax",
      });
    });

    totalTaxCollected += taxAmount;
    logger.info({ casinoId: casino.id, taxAmount, bankrollBefore, bankrollAfter }, "Casino taxed");
  }

  if (totalTaxCollected > 0) {
    await db.update(poolTable).set({
      totalAmount: (parseFloat(pool.totalAmount) + totalTaxCollected).toFixed(2),
    }).where(eq(poolTable.id, pool.id));
    logger.info({ totalTaxCollected }, "Monthly tax completed — pool updated");
  } else {
    logger.info("No casinos had bankroll to tax");
  }
}

export function scheduleTax() {
  // Run at 00:00 on the 1st of every month
  cron.schedule("0 0 1 * *", async () => {
    try { await runMonthlyTax(); }
    catch (err) { logger.error({ err }, "Monthly tax failed"); }
  });
  logger.info("Casino monthly tax scheduler initialized");
}
