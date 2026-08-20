import { desc, eq } from "drizzle-orm";
import { events, hops, intents } from "../db/schema";
import { getDb } from "../db";
import type { LiveMarket } from "./somnia";

export type IntentRequest = { marketId: string; outcome: "YES" | "NO"; limitPrice: string; quantity: string };

const timestamp = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export async function createArmedIntent(request: IntentRequest, market: LiveMarket) {
  if (market.operatorId === null || !market.venueId) throw new Error("The selected market is missing a stable series identity.");
  const db = getDb();
  const active = await db.select({ id: intents.id }).from(intents).where(eq(intents.state, "ARMED")).limit(1);
  if (active.length) throw new Error("Only one active RELAY intent is allowed.");
  const now = timestamp();
  const intentId = id("intent");
  await db.batch([
    db.insert(intents).values({ id: intentId, state: "ARMED", operatorId: market.operatorId, venueId: market.venueId, asset: market.asset, intervalSec: Number(market.intervalSec), outcome: request.outcome, limitPrice: request.limitPrice, requestedQuantity: request.quantity, remainingQuantity: request.quantity, sourceMarketId: market.marketId, currentMarketId: market.marketId, createdAt: now, updatedAt: now }),
    db.insert(hops).values({ id: id("hop"), intentId, sequence: 0, sourceMarketId: market.marketId, poolAddress: market.poolAddress, remainingQuantity: request.quantity, state: "ARMED", createdAt: now, updatedAt: now }),
    db.insert(events).values({ intentId, type: "INTENT_ARMED", payload: JSON.stringify({ request, seriesKey: [market.operatorId, market.venueId, market.asset, market.intervalSec] }), createdAt: now }),
  ]);
  return intentId;
}

export async function latestIntent() {
  const db = getDb();
  return (await db.select().from(intents).orderBy(desc(intents.createdAt)).limit(1))[0] || null;
}
