import { desc, eq, inArray } from "drizzle-orm";
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

export async function activeIntent() {
  const db = getDb();
  return (await db.select().from(intents).where(inArray(intents.state, ["ARMED", "PLACING", "ACTIVE", "ROLLING"])).orderBy(desc(intents.createdAt)).limit(1))[0] || null;
}

export async function setIntentState(intentId: string, state: string, details: { error?: string; currentMarketId?: string; remainingQuantity?: string; rollsUsed?: number } = {}) {
  const db = getDb(); const now = timestamp();
  await db.update(intents).set({ state, lastError: details.error ?? null, currentMarketId: details.currentMarketId, remainingQuantity: details.remainingQuantity, rollsUsed: details.rollsUsed, updatedAt: now }).where(eq(intents.id, intentId));
  await db.insert(events).values({ intentId, type: `STATE_${state}`, payload: JSON.stringify(details), createdAt: now });
}

export async function currentHop(intentId: string) {
  const db = getDb();
  return (await db.select().from(hops).where(eq(hops.intentId, intentId)).orderBy(desc(hops.sequence)).limit(1))[0] || null;
}

export async function recordPlacement(intentId: string, values: { hash: string; orderId: string | null; pool: string; nonce: string; price: string; quantity: string; filled: string; remaining: string }) {
  const db = getDb(); const now = timestamp(); const hop = await currentHop(intentId);
  if (!hop) throw new Error("Missing relay hop.");
  await db.batch([
    db.update(hops).set({ transactionHash: values.hash, orderId: values.orderId, poolAddress: values.pool, nonce: values.nonce, alignedPrice: values.price, alignedQuantity: values.quantity, filledQuantity: values.filled, remainingQuantity: values.remaining, state: values.remaining === "0" ? "FILLED" : "ACTIVE", updatedAt: now }).where(eq(hops.id, hop.id)),
    db.update(intents).set({ state: values.remaining === "0" ? "COMPLETED" : "ACTIVE", remainingQuantity: values.remaining, updatedAt: now, lastError: null }).where(eq(intents.id, intentId)),
    db.insert(events).values({ intentId, type: "ORDER_CONFIRMED", payload: JSON.stringify(values), createdAt: now }),
  ]);
}

export async function recordReconciliation(intentId: string, remaining: string, state: string) {
  const db = getDb(); const now = timestamp(); const hop = await currentHop(intentId);
  if (!hop) throw new Error("Missing relay hop.");
  await db.batch([
    db.update(hops).set({ remainingQuantity: remaining, filledQuantity: (BigInt(hop.alignedQuantity ?? "0") - BigInt(remaining)).toString(), state, updatedAt: now }).where(eq(hops.id, hop.id)),
    db.update(intents).set({ state: remaining === "0" ? "COMPLETED" : "ACTIVE", remainingQuantity: remaining, updatedAt: now }).where(eq(intents.id, intentId)),
    db.insert(events).values({ intentId, type: "ORDER_RECONCILED", payload: JSON.stringify({ remaining, state }), createdAt: now }),
  ]);
}

export async function startSuccessorHop(intentId: string, sourceMarketId: string, destinationMarketId: string, remaining: string) {
  const db = getDb(); const now = timestamp(); const prior = await currentHop(intentId);
  if (!prior) throw new Error("Missing source hop.");
  const sequence = prior.sequence + 1;
  await db.batch([
    db.insert(hops).values({ id: id("hop"), intentId, sequence, sourceMarketId, destinationMarketId, remainingQuantity: remaining, state: "ARMED", createdAt: now, updatedAt: now }),
    db.update(intents).set({ state: "ROLLING", currentMarketId: destinationMarketId, rollsUsed: sequence, updatedAt: now }).where(eq(intents.id, intentId)),
    db.insert(events).values({ intentId, type: "SUCCESSOR_VERIFIED", payload: JSON.stringify({ sourceMarketId, destinationMarketId, remaining }), createdAt: now }),
  ]);
}
