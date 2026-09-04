export const SHANNON = {
  chainId: "50312",
  rpc: "https://api.infra.testnet.somnia.network",
  indexer: "https://dev.smk.somnia.host/v1/graphql",
  binaryModule: "0x3ecC694Cef705358864a646142ac17A90E29e388",
  collateral: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
} as const;

export type LiveMarket = { marketId: string; poolAddress: string; asset: string; intervalSec: string; expiry: string; tradingStart: string; operatorId: number | null; venueId: string | null; status: string; collateral: string };

type MarketRow = { id: string; poolAddress: string; asset: string; intervalSec: string | null; expiry: string; tradingStart: string; operatorId: number | null; venueId: string | null; clobStatus: string | null; collateral: string };
const toLiveMarket = (m: MarketRow): LiveMarket => ({ marketId: m.id, poolAddress: m.poolAddress, asset: m.asset, intervalSec: m.intervalSec ?? "", expiry: m.expiry, tradingStart: m.tradingStart, operatorId: m.operatorId, venueId: m.venueId, status: m.clobStatus ?? "Unknown", collateral: m.collateral });

async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(SHANNON.indexer, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }), cache: "no-store" });
  const payload = await response.json() as { data?: T; errors?: { message: string }[] };
  if (!response.ok || payload.errors?.length || !payload.data) throw new Error(payload.errors?.[0]?.message ?? `Indexer returned ${response.status}`);
  return payload.data;
}

export async function getLiveMarkets(): Promise<LiveMarket[]> {
  const now = String(Math.floor(Date.now() / 1000));
  const data = await graphql<{ Market: MarketRow[] }>(
    `query RelayMarkets($now:numeric!) { Market(where:{marketType:{_eq:"BINARY"},expiry:{_gt:$now}},order_by:{expiry:asc},limit:50){ id poolAddress asset intervalSec expiry tradingStart operatorId venueId clobStatus collateral } }`, { now },
  );
  return data.Market.filter((m) => m.intervalSec && m.asset).map(toLiveMarket);
}

export async function getMarketById(marketId: string) {
  const data = await graphql<{ Market: MarketRow[] }>(`query RelayMarket($id: String!) { Market(where:{id:{_eq:$id}},limit:1){ id poolAddress asset intervalSec expiry tradingStart operatorId venueId clobStatus collateral } }`, { id: marketId.toLowerCase() });
  const market = data.Market[0]; return market ? toLiveMarket(market) : null;
}

async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(SHANNON.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store" });
  const body = await response.json() as { result?: string; error?: { message: string } };
  if (body.error || body.result === undefined) throw new Error(body.error?.message ?? "RPC returned no result");
  return body.result;
}

export async function inspectShannon() {
  const [chainHex, binaryCode, collateralCode] = await Promise.all([rpc("eth_chainId"), rpc("eth_getCode", [SHANNON.binaryModule, "latest"]), rpc("eth_getCode", [SHANNON.collateral, "latest"])]);
  return { chainId: String(parseInt(chainHex, 16)), deployment: binaryCode !== "0x" && collateralCode !== "0x" ? "verified" as const : "degraded" as const };
}
