import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { platformEnv } from "../lib/platform-env";

let client: Client | null = null;
let db: LibSQLDatabase<typeof schema> | null = null;
let schemaReady: Promise<void> | null = null;

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS relay_intents (id TEXT PRIMARY KEY, state TEXT NOT NULL, operator_id INTEGER NOT NULL, venue_id TEXT NOT NULL, asset TEXT NOT NULL, interval_sec INTEGER NOT NULL, outcome TEXT NOT NULL, limit_price TEXT NOT NULL, requested_quantity TEXT NOT NULL, remaining_quantity TEXT NOT NULL, source_market_id TEXT NOT NULL, current_market_id TEXT NOT NULL, rolls_used INTEGER DEFAULT 0 NOT NULL, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS relay_hops (id TEXT PRIMARY KEY, intent_id TEXT NOT NULL REFERENCES relay_intents(id), sequence INTEGER NOT NULL, source_market_id TEXT NOT NULL, destination_market_id TEXT, pool_address TEXT, nonce TEXT, transaction_hash TEXT, order_id TEXT, aligned_price TEXT, aligned_quantity TEXT, filled_quantity TEXT DEFAULT '0' NOT NULL, remaining_quantity TEXT NOT NULL, state TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS relay_events (id INTEGER PRIMARY KEY AUTOINCREMENT, intent_id TEXT NOT NULL REFERENCES relay_intents(id), type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hops_intent_sequence_idx ON relay_hops (intent_id, sequence)`,
  `CREATE INDEX IF NOT EXISTS intents_state_idx ON relay_intents (state)`,
  `CREATE INDEX IF NOT EXISTS events_intent_idx ON relay_events (intent_id, created_at)`,
];

function connect(): LibSQLDatabase<typeof schema> {
  const url = platformEnv.TURSO_URL;
  if (!url) {
    throw new Error(
      "No Turso database is configured. Set TURSO_URL (and TURSO_AUTH_TOKEN for remote) to enable intents, hops, and the event ledger."
    );
  }
  if (!db) {
    client = createClient({ url, authToken: platformEnv.TURSO_AUTH_TOKEN });
    db = drizzle(client, { schema });
    schemaReady = (async () => {
      for (const sql of SCHEMA_SQL) {
        await client!.execute(sql);
      }
    })();
  }
  return db;
}

export function getDb() {
  return connect();
}

/** Await once at each write entry point so DDL finishes before first insert. */
export async function ready() {
  connect();
  await schemaReady;
}
