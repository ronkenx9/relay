import { env } from "cloudflare:workers";
import { activeIntent, currentHop, recordPlacement, recordReconciliation, setIntentState, startSuccessorHop } from "../../../../lib/intents";
import { selectDirectSuccessor, unitsToDecimal } from "../../../../lib/relay-core";
import { assertTradableMarket, placeBoundedLimit, reconcileOrder, reconcileTerminalOrder } from "../../../../lib/somnia-execution";
import { getLiveMarkets, getMarketById } from "../../../../lib/somnia";

export const runtime = "edge";

const config = () => ({ privateKey: env.RELAY_PRIVATE_KEY as `0x${string}`, maxCollateral: env.RELAY_MAX_COLLATERAL || "10", maxQuantity: env.RELAY_MAX_QUANTITY || "10" });
const fail = async (intentId: string, error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown worker failure.";
  await setIntentState(intentId, "PAUSED", { error: message });
  return Response.json({ state: "PAUSED", intentId, reason: message }, { status: 409 });
};

export async function POST(request: Request): Promise<Response> {
  if (!env.RELAY_WORKER_TOKEN || request.headers.get("x-relay-worker-token") !== env.RELAY_WORKER_TOKEN) return Response.json({ error: "Worker token required." }, { status: 401 });
  if (!env.RELAY_PRIVATE_KEY) return Response.json({ state: "BLOCKED", reason: "No dedicated Shannon testnet signer is configured." }, { status: 503 });
  const intent = await activeIntent();
  if (!intent) return Response.json({ state: "IDLE", reason: "No non-terminal intent." });
  if (intent.state === "PLACING") return fail(intent.id, "Placement outcome is uncertain after an interrupted worker run. Reconcile manually; RELAY will not resend.");

  try {
    const live = await getLiveMarkets();
    const market = live.find((item) => item.marketId.toLowerCase() === intent.currentMarketId.toLowerCase());
    if (intent.state === "ARMED" || intent.state === "ROLLING") {
      if (!market) return fail(intent.id, "Current market is absent from live discovery; refusing a write.");
      await setIntentState(intent.id, "PLACING");
      const verified = intent.state === "ROLLING" ? await assertTradableMarket(config().privateKey, market) : null;
      const decimals = verified?.onchain.decimals ?? 0;
      verified?.sdk.close();
      const placed = await placeBoundedLimit(config(), market, intent.outcome as "YES" | "NO", intent.limitPrice, intent.state === "ROLLING" ? unitsToDecimal(BigInt(intent.remainingQuantity), decimals) : intent.requestedQuantity);
      await recordPlacement(intent.id, placed);
      return Response.json({ state: placed.remaining === "0" ? "COMPLETED" : "ACTIVE", intentId: intent.id, transactionHash: placed.hash, orderId: placed.orderId, remaining: placed.remaining });
    }

    const hop = await currentHop(intent.id);
    if (!hop || !hop.orderId || !hop.poolAddress) return fail(intent.id, "Active intent has no durable resting-order identity.");
    const order = await reconcileOrder(config().privateKey, hop.poolAddress, hop.orderId);
    if (order) {
      await recordReconciliation(intent.id, order.quantityRemaining.toString(), "ACTIVE");
      return Response.json({ state: "ACTIVE", intentId: intent.id, remaining: order.quantityRemaining.toString(), orderId: hop.orderId });
    }

    const source = await getMarketById(hop.sourceMarketId);
    if (!source) return fail(intent.id, "Could not prove source market identity after the order left the book.");
    if (Number(source.expiry) > Math.floor(Date.now() / 1000)) return fail(intent.id, "Order disappeared before market expiry; reconciliation is ambiguous and no roll will be sent.");
    const indexed = await reconcileTerminalOrder(config().privateKey, hop.poolAddress, hop.orderId);
    if (!indexed) return fail(intent.id, "Expired order is not yet indexed; RELAY will wait rather than guess its remainder.");
    const remainder = indexed.quantityRemaining.toString();
    if (remainder === "0") { await recordReconciliation(intent.id, "0", "FILLED"); return Response.json({ state: "COMPLETED", intentId: intent.id }); }
    if (intent.rollsUsed >= 1) return fail(intent.id, "One-successor-roll bound reached; remaining exposure is paused.");
    const successor = selectDirectSuccessor({ operatorId: intent.operatorId, venueId: intent.venueId, asset: intent.asset, intervalSec: intent.intervalSec, marketId: source.marketId, expiry: Number(source.expiry) }, live.filter((item) => item.operatorId !== null && item.venueId).map((item) => ({ operatorId: item.operatorId!, venueId: item.venueId!, asset: item.asset, intervalSec: Number(item.intervalSec), marketId: item.marketId, expiry: Number(item.expiry) })));
    const destination = live.find((item) => item.marketId === successor.marketId);
    if (!destination) return fail(intent.id, "Verified successor vanished before placement.");
    const verifiedSuccessor = await assertTradableMarket(config().privateKey, destination);
    verifiedSuccessor.sdk.close();
    await startSuccessorHop(intent.id, source.marketId, destination.marketId, remainder);
    return POST(request);
  } catch (error) { return fail(intent.id, error); }
}
