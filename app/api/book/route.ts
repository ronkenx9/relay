import { SOMNIA_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { SHANNON } from "../../../lib/somnia";

/** Read-only live order book for one pool. No signer, no writes. Powers the paper demo tab. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pool = searchParams.get("pool");
  if (!pool || !/^0x[0-9a-fA-F]{40}$/.test(pool)) {
    return Response.json({ error: "pool query param required (0x address)." }, { status: 400 });
  }
  const ex = new SomniaMarkets({
    indexerUrl: SHANNON.indexer,
    chain: somniaShannon,
    wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
    addresses: SOMNIA_TESTNET_ADDRESSES,
  });
  try {
    const book = await ex.client.getBinaryOrderBook(pool as `0x${string}`);
    const safe = JSON.parse(JSON.stringify(book, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    return Response.json({ pool, book: safe }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Book read failed." }, { status: 503 });
  } finally {
    try { ex.close(); } catch { /* already closed */ }
  }
}
