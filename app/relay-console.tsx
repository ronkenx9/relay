"use client";

import { BadgeCheck, Radio, RotateCw, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Health = { network: string; deployment: string; signer: string; persistence: string };
type Market = { marketId: string; poolAddress: string; asset: string; intervalSec: string; expiry: string; tradingStart: string; operatorId: number | null; venueId: string | null; status: string; collateral: string };
type Feed = { markets: Market[]; observedAt: string };
const EMPTY_MARKETS: Market[] = [];

const short = (value?: string) => value ? `${value.slice(0, 8)}…${value.slice(-4)}` : "—";
const cadence = (seconds: string) => `${Math.max(1, Math.round(Number(seconds) / 60))}m`;
const left = (expiry?: string) => {
  const ms = new Date(expiry || 0).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "window closed";
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export function RelayConsole() {
  const [health, setHealth] = useState<Health>();
  const [feed, setFeed] = useState<Feed>();
  const [selectedId, setSelectedId] = useState("");
  const [price, setPrice] = useState("0.55");
  const [quantity, setQuantity] = useState("1");
  const [outcome, setOutcome] = useState("YES");
  const [message, setMessage] = useState("Reading the live Shannon relay lane…");

  const refresh = async () => {
    try {
      const [h, f] = await Promise.all([fetch("/api/health"), fetch("/api/series")]);
      if (h.ok) setHealth(await h.json());
      if (f.ok) setFeed(await f.json()); else setMessage("Market discovery is temporarily unavailable. The operator lane remains read-only.");
    } catch { setMessage("Could not reach the relay service."); }
  };
  useEffect(() => { const initial = window.setTimeout(refresh, 0); const timer = window.setInterval(refresh, 12000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, []);
  const markets = feed?.markets ?? EMPTY_MARKETS;
  const market = useMemo(() => markets.find((m) => m.marketId === selectedId) || markets.find((m) => m.asset === "BTC" && m.intervalSec === "900") || markets[0], [markets, selectedId]);
  const canArm = health?.signer === "ready" && Boolean(market);
  const arm = (event: FormEvent) => { event.preventDefault(); setMessage(canArm ? "Control token required: submit this intent through the protected operator endpoint." : "Arming is intentionally unavailable until a Shannon testnet signer is configured."); };

  return <main className="shell">
    <header className="topbar"><div className="wordmark">REL<i>A</i>Y</div><div className="network"><span className="dot" /> SHANNON TESTNET · BUY-ONLY</div></header>
    <section className="hero"><div><div className="eyebrow">PREDICTION-MARKET ORDER CONTINUITY</div><h1>Set the price.<br />Keep the intent.</h1><p>RELAY rests a normal limit order through the current binary-market window, verifies the next market in the same series, then carries only the unfilled remainder forward.</p></div><div className="principle"><b>NO INVENTED EXECUTION</b><span>Every state change is evidence-backed: market identity, pool generation, order receipt, fill ledger, and successor verification.</span></div></section>
    <section className="grid"><div className="panel"><div className="panel-head"><div className="panel-title"><Radio size={15} /> LIVE RELAY LANE</div><span className="stamp">{feed ? `REFRESHED ${new Date(feed.observedAt).toLocaleTimeString()}` : "CONNECTING"}</span></div><div className="lane">
      <div className="market"><div><div className="asset">{market?.asset || "—"} / {market ? cadence(market.intervalSec) : "—"}</div><div className="detail">Binary market · {market ? short(market.marketId) : "loading market"}</div></div><div className="detail">OPERATOR {market?.operatorId ?? "—"}<br />VENUE {market?.venueId ?? "—"}</div><div className="countdown"><small>CURRENT WINDOW</small>{left(market?.expiry)}</div></div>
      <form onSubmit={arm}><select className="series" aria-label="Market series" value={market?.marketId || ""} onChange={(e) => setSelectedId(e.target.value)}>{markets.length ? markets.map((item) => <option key={item.marketId} value={item.marketId}>{item.asset} · {cadence(item.intervalSec)} · ends {new Date(item.expiry).toLocaleTimeString()}</option>) : <option>Discovering live markets…</option>}</select>
      <div className="steps"><div className="step active">REST UNTIL LOCK<small>Normal limit order; no IOC.</small></div><div className="step">VERIFY SUCCESSOR<small>Series key + on-chain generation.</small></div><div className="step">RESTATE REMAINDER<small>One successor roll maximum.</small></div></div>
      <div className="fields"><label>OUTCOME<select value={outcome} onChange={(e) => setOutcome(e.target.value)}><option>YES</option><option>NO</option></select></label><label>LIMIT PRICE<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label><label>QUANTITY<input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label><button className="arm" disabled={!canArm}>ARM TESTNET INTENT</button></div></form>
      <p className="notice">{message} Price and size are snapped to the discovered market grid before any order can be sent.</p>
    </div></div><aside className="right"><section className="safety"><h2>Guardrails are the product.</h2><div className="checks"><div className="check"><ShieldCheck /><div><strong>Testnet-only signer</strong>No browser key custody. Writes require a server-side Shannon testnet key.</div></div><div className="check"><BadgeCheck /><div><strong>Bounded exposure</strong>Buy-only, one active intent, max collateral and quantity caps.</div></div><div className="check"><RotateCw /><div><strong>One verified roll</strong>Never assumes a reused pool is the next generation.</div></div></div></section><section className="panel proof"><h2>Execution proof</h2><div className="row"><span>Network</span><b>{health?.network || "Checking"}</b></div><div className="row"><span>Contracts</span><b>{health?.deployment || "Checking"}</b></div><div className="row"><span>Signer</span><b>{health?.signer || "Checking"}</b></div><div className="row"><span>Ledger</span><b>{health?.persistence || "Checking"}</b></div><div className="status">This production console is safe by default. Add the protected server configuration only after funding and testing a dedicated Shannon wallet.</div></section></aside></section>
  </main>;
}
