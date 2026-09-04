import { env } from "cloudflare:workers";
import { currentHop, intentById, recordCancellation } from "../../../../../lib/intents";
import { cancelRestingOrder } from "../../../../../lib/somnia-execution";

export const runtime = "edge";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!env.RELAY_PRIVATE_KEY) return Response.json({ error: "A Shannon testnet signer is not configured." }, { status: 503 });
  if (!env.RELAY_CONTROL_TOKEN || request.headers.get("x-relay-control-token") !== env.RELAY_CONTROL_TOKEN) return Response.json({ error: "Protected operator token required." }, { status: 401 });
  const { id } = await context.params; const intent = await intentById(id); const hop = await currentHop(id);
  if (!intent || !hop || !hop.orderId || !hop.poolAddress || intent.state !== "ACTIVE") return Response.json({ error: "No active resting order is available to cancel." }, { status: 409 });
  try {
    const transactionHash = await cancelRestingOrder(env.RELAY_PRIVATE_KEY as `0x${string}`, hop.poolAddress, hop.orderId);
    await recordCancellation(id, transactionHash);
    return Response.json({ state: "PAUSED", intentId: id, transactionHash });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Cancel failed." }, { status: 409 }); }
}
