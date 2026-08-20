import { env } from "cloudflare:workers";
import { latestIntent } from "../../../../lib/intents";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!env.RELAY_WORKER_TOKEN || request.headers.get("x-relay-worker-token") !== env.RELAY_WORKER_TOKEN) return Response.json({ error: "Worker token required." }, { status: 401 });
  if (!env.RELAY_PRIVATE_KEY) return Response.json({ state: "BLOCKED", reason: "No dedicated Shannon testnet signer is configured." }, { status: 503 });
  const intent = await latestIntent();
  if (!intent) return Response.json({ state: "IDLE", reason: "No armed intent." });
  return Response.json({ state: "HOLD", intentId: intent.id, reason: "Worker is installed but order submission is deliberately disabled until the signer has passed its funded testnet qualification." });
}
