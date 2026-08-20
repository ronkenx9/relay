import { env } from "cloudflare:workers";
import { inspectShannon } from "../../../lib/somnia";

export const runtime = "edge";
export async function GET() {
  try {
    const inspection = await inspectShannon();
    return Response.json({ ...inspection, network: "SHANNON TESTNET", signer: env.RELAY_PRIVATE_KEY ? "ready" : "not_configured", persistence: env.DB ? "D1 durable ledger" : "preview memory", rpc: "healthy" });
  } catch (error) {
    return Response.json({ chainId: "unknown", network: "SHANNON TESTNET", signer: "not_configured", persistence: env.DB ? "D1 durable ledger" : "preview memory", deployment: "degraded", error: error instanceof Error ? error.message : "Network probe failed" }, { status: 503 });
  }
}
