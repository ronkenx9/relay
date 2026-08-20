import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const intents = sqliteTable("relay_intents", {
  id: text("id").primaryKey(),
  state: text("state").notNull(),
  operatorId: integer("operator_id").notNull(),
  venueId: text("venue_id").notNull(),
  asset: text("asset").notNull(),
  intervalSec: integer("interval_sec").notNull(),
  outcome: text("outcome").notNull(),
  limitPrice: text("limit_price").notNull(),
  requestedQuantity: text("requested_quantity").notNull(),
  remainingQuantity: text("remaining_quantity").notNull(),
  sourceMarketId: text("source_market_id").notNull(),
  currentMarketId: text("current_market_id").notNull(),
  rollsUsed: integer("rolls_used").notNull().default(0),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("intents_state_idx").on(table.state), index("intents_series_idx").on(table.operatorId, table.venueId, table.asset, table.intervalSec)]);

export const hops = sqliteTable("relay_hops", {
  id: text("id").primaryKey(),
  intentId: text("intent_id").notNull().references(() => intents.id),
  sequence: integer("sequence").notNull(),
  sourceMarketId: text("source_market_id").notNull(),
  destinationMarketId: text("destination_market_id"),
  poolAddress: text("pool_address"),
  nonce: text("nonce"),
  transactionHash: text("transaction_hash"),
  orderId: text("order_id"),
  alignedPrice: text("aligned_price"),
  alignedQuantity: text("aligned_quantity"),
  filledQuantity: text("filled_quantity").notNull().default("0"),
  remainingQuantity: text("remaining_quantity").notNull(),
  state: text("state").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("hops_intent_sequence_idx").on(table.intentId, table.sequence), index("hops_state_idx").on(table.state)]);

export const events = sqliteTable("relay_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  intentId: text("intent_id").notNull().references(() => intents.id),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("events_intent_idx").on(table.intentId, table.createdAt)]);
