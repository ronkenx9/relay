import { platformEnv } from "../../../lib/platform-env";
import { ready } from "../../../db";
import { createArmedIntent, latestIntent, type IntentRequest } from "../../../lib/intents";
import { getLiveMarkets } from "../../../lib/somnia";

const validNumber = (value: unknown) => typeof value === "string" && Number.isFinite(Number(value)) && Number(value) > 0;

export async function GET() {
  try { return Response.json({ intent: await latestIntent() }); }
  catch { return Response.json({ intent: null, persistence: "unavailable" }); }
}

export async function POST(request: Request) {
  if (!platformEnv.RELAY_PRIVATE_KEY) return Response.json({ error: "A Shannon testnet signer is not configured." }, { status: 503 });
  if (!platformEnv.RELAY_CONTROL_TOKEN || request.headers.get("x-relay-control-token") !== platformEnv.RELAY_CONTROL_TOKEN) return Response.json({ error: "Protected operator token required." }, { status: 401 });
  const payload = await request.json() as Partial<IntentRequest>;
  if (!payload.marketId || (payload.outcome !== "YES" && payload.outcome !== "NO") || !validNumber(payload.limitPrice) || !validNumber(payload.quantity) || Number(payload.limitPrice) >= 1) return Response.json({ error: "Invalid intent payload." }, { status: 400 });
  const market = (await getLiveMarkets()).find((item) => item.marketId === payload.marketId);
  if (!market) return Response.json({ error: "Selected market is no longer discoverable." }, { status: 409 });
  try { await ready(); return Response.json({ intentId: await createArmedIntent(payload as IntentRequest, market), state: "ARMED" }, { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not arm intent." }, { status: 409 }); }
}
