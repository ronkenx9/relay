import { platformEnv } from "../../../lib/platform-env";
import { inspectShannon } from "../../../lib/somnia";

export async function GET() {
  try {
    const inspection = await inspectShannon();
    return Response.json({ ...inspection, network: "SHANNON TESTNET", signer: platformEnv.RELAY_PRIVATE_KEY ? "ready" : "not_configured", persistence: platformEnv.TURSO_URL ? "turso ledger" : "preview memory", rpc: "healthy" });
  } catch (error) {
    return Response.json({ chainId: "unknown", network: "SHANNON TESTNET", signer: "not_configured", persistence: platformEnv.TURSO_URL ? "turso ledger" : "preview memory", deployment: "degraded", error: error instanceof Error ? error.message : "Network probe failed" }, { status: 503 });
  }
}
