import { getLiveMarkets } from "../../../lib/somnia";

export async function GET() {
  try { return Response.json({ markets: await getLiveMarkets(), observedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } }); }
  catch (error) { return Response.json({ markets: [], observedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Live market discovery failed" }, { status: 503 }); }
}
