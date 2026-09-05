"use client";

import { ArrowDown, ArrowUpRight, BadgeCheck, FlaskConical, Radio, RotateCw, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Health = { network: string; deployment: string; signer: string; persistence: string };
type Market = { marketId: string; poolAddress: string; asset: string; intervalSec: string; expiry: string; tradingStart: string; operatorId: number | null; venueId: string | null; status: string; collateral: string };
type Feed = { markets: Market[]; observedAt: string };
const EMPTY_MARKETS: Market[] = [];

const short = (value?: string | null) => value ? `${value.slice(0, 8)}…${value.slice(-4)}` : "—";
const cadence = (seconds: string) => `${Math.max(1, Math.round(Number(seconds) / 60))}m`;
const left = (expiry?: string) => {
  const ms = new Date(expiry || 0).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "window closed";
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const toUnits = (decimal: string) => BigInt(Math.round(Number(decimal) * 1_000_000));
const fromUnits = (units: string) => (Number(units) / 1_000_000).toFixed(2);
const expLeft = (expiry?: string) => left(expiry ? new Date(Number(expiry) * 1000).toISOString() : undefined);
const expTime = (expiry?: string) => (expiry ? new Date(Number(expiry) * 1000).toLocaleTimeString() : "—");

const EXPLORER = "https://shannon-explorer.somnia.network/tx/";
const PROOF_TXS = [
  { label: "Faucet · 10k testUSDC", hash: "0x2ef2806464c982747359c8611b64d1f5121d69499ffaf51baf090dd95cd49240" },
  { label: "Place · BUY_YES 0.10 x 1 · 15m ETH", hash: "0x530560b008164f67bcc6fd6f867a7579dd270f0fd4038be264fdf00f67c59e4f" },
  { label: "Cancel · same order", hash: "0xaa2b165dd9e486d736dcecedf38fbfdf9dd1ab15abe2d2966968ad214c0a2b2f" },
  { label: "Rollover old · BTC 300s 0x…1318c", hash: "0x6bfe9b2ffb9f1085a08af228ebb2b546f381b466043da76241ac94bba84ab1b8" },
  { label: "Rollover new · successor 0x…1319a", hash: "0xacdc16ded8a862201bbc918af1f52b1bed54bfd5bf8aafd8edfe38ffb07dd8be" },
];

function GlowWord({ children, color = "#C5F04D" }: { children: React.ReactNode; color?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        color,
        transition: "text-shadow 0.3s ease",
        textShadow: hovered
          ? `0 0 20px ${color}E6, 0 0 50px ${color}99, 0 0 100px ${color}4D`
          : "none",
      }}
    >
      {children}
    </span>
  );
}

type PaperState = "RESTING" | "FILLED" | "RELAYED" | "PAUSED" | "EXPIRED";
type Paper = {
  oldId: string; pool: string; expiry: string; outcome: string;
  price: string; qty: string; remaining: string; state: PaperState;
  newId?: string; newPool?: string; newExpiry?: string; note?: string;
};

function DemoTab({ markets }: { markets: Market[] }) {
  const [marketId, setMarketId] = useState("");
  const [outcome, setOutcome] = useState("YES");
  const [price, setPrice] = useState("0.60");
  const [qty, setQty] = useState("1");
  const [paper, setPaper] = useState<Paper | null>(null);
  const [bookLine, setBookLine] = useState("Waiting for first book read…");
  const [err, setErr] = useState("");

  const market = useMemo(
    () => markets.find((m) => m.marketId === marketId) || markets.find((m) => m.asset === "BTC") || markets[0],
    [markets, marketId]
  );

  const armPaper = (event: FormEvent) => {
    event.preventDefault();
    setErr("");
    if (!market) { setErr("No live market right now. Wait a few seconds and try again."); return; }
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0 || p >= 1) { setErr("Price must be between 0 and 1, like 0.60."); return; }
    if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) { setErr("Quantity must be above zero."); return; }
    if (Number(market.expiry) * 1000 <= Date.now()) { setErr("That window already closed. Pick the next one."); return; }
    setBookLine("Paper order placed. Reading the live book…");
    setPaper({ oldId: market.marketId, pool: market.poolAddress, expiry: market.expiry, outcome, price, qty, remaining: qty, state: "RESTING" });
  };

  useEffect(() => {
    if (!paper || paper.state === "FILLED" || paper.state === "PAUSED" || paper.state === "EXPIRED") return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (stop) return;
      try {
        const watchingPool = paper.state === "RELAYED" && paper.newPool ? paper.newPool : paper.pool;
        const watchingExpiry = paper.state === "RELAYED" && paper.newExpiry ? paper.newExpiry : paper.expiry;
        const res = await fetch(`/api/book?pool=${watchingPool}`);
        if (!res.ok) throw new Error("Book read failed.");
        const { book } = await res.json();
        const side = paper.outcome === "YES" ? "yesAsks" : "noAsks";
        const levels = (book?.[side] ?? []) as { price: string }[];
        const best = levels[0]?.price;
        if (best !== undefined) {
          setBookLine(`Best ${paper.outcome === "YES" ? "YES ask" : "NO ask"} ${fromUnits(best)} · your price ${paper.price}`);
          if (BigInt(best) <= toUnits(paper.price)) {
            setPaper((prev) => prev && { ...prev, remaining: "0", state: "FILLED", note: `Taken at ${fromUnits(best)}. In a real market you would now own the position.` });
            return;
          }
        }
        if (Number(watchingExpiry) * 1000 <= Date.now()) {
          if (paper.state === "RELAYED") {
            setPaper((prev) => prev && { ...prev, state: "EXPIRED", note: "Second window closed. One roll is the limit, so the paper order ends here." });
            return;
          }
          const old = markets.find((m) => m.marketId === paper.oldId);
          const cands = markets
            .filter((m) => old && m.operatorId === old.operatorId && m.venueId === old.venueId && m.asset === old.asset && m.intervalSec === old.intervalSec)
            .filter((m) => m.marketId.toLowerCase() !== paper.oldId.toLowerCase() && Number(m.expiry) > Number(paper.expiry))
            .sort((a, b) => Number(a.expiry) - Number(b.expiry) || a.marketId.localeCompare(b.marketId));
          if (!cands.length) {
            setPaper((prev) => prev && { ...prev, state: "PAUSED", note: "No next window found. RELAY holds instead of guessing." });
            return;
          }
          const same = cands.filter((c) => c.expiry === cands[0].expiry).length;
          if (same !== 1) {
            setPaper((prev) => prev && { ...prev, state: "PAUSED", note: `${same} markets share the next expiry. Ambiguous, so RELAY holds instead of guessing.` });
            return;
          }
          const next = cands[0];
          setPaper((prev) => prev && { ...prev, state: "RELAYED", newId: next.marketId, newPool: next.poolAddress, newExpiry: next.expiry, note: `Carried ${prev?.remaining} into ${next.asset} ${cadence(next.intervalSec)} ${short(next.marketId)}.` });
          return;
        }
      } catch (e) { setBookLine(e instanceof Error ? e.message : "Book read failed."); }
      if (!stop) timer = setTimeout(loop, 5000);
    };
    timer = setTimeout(loop, 0);
    return () => { stop = true; clearTimeout(timer); };
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-5 rounded-xl bg-[#0F0F11] border border-[#2A2A2F] px-4 py-3">
        <FlaskConical size={15} className="text-[#C5F04D] shrink-0" />
        <p className="text-[12px] text-[#A0A0AB] leading-relaxed">Paper demo on live testnet markets. No wallet, no real orders, nothing moves. The real console needs an operator signer.</p>
      </div>
      {!paper ? (
        <form onSubmit={armPaper}>
          <select aria-label="Demo market" value={market?.marketId || ""} onChange={(e) => setMarketId(e.target.value)} className="w-full rounded-xl border border-[#2A2A2F] bg-[#0F0F11] px-4 py-3 text-sm text-[#EEEEEF] mb-4 focus:outline-none focus:border-[#C5F04D]">
            {markets.length ? markets.map((item) => <option key={item.marketId} value={item.marketId}>{item.asset} · {cadence(item.intervalSec)} · ends {new Date(Number(item.expiry) * 1000).toLocaleTimeString()}</option>) : <option>Discovering live markets…</option>}
          </select>
          <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
            <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[#6C6C74]">Side
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="mt-2 block w-full rounded-xl border border-[#2A2A2F] bg-[#0F0F11] px-4 py-3 text-sm text-[#EEEEEF] focus:outline-none focus:border-[#C5F04D]"><option>YES</option><option>NO</option></select>
            </label>
            <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[#6C6C74]">Your price
              <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-2 block w-full rounded-xl border border-[#2A2A2F] bg-[#0F0F11] px-4 py-3 text-sm text-[#EEEEEF] focus:outline-none focus:border-[#C5F04D]" />
            </label>
            <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[#6C6C74]">Size
              <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-2 block w-full rounded-xl border border-[#2A2A2F] bg-[#0F0F11] px-4 py-3 text-sm text-[#EEEEEF] focus:outline-none focus:border-[#C5F04D]" />
            </label>
            <button className="rounded-full bg-[#C5F04D] px-6 py-3 text-[11px] font-extrabold tracking-[0.08em] text-[#0F0F11] transition-all hover:scale-95 active:scale-90 hover:bg-[#EEEEEF] min-h-[44px]">TRY IT PAPER</button>
          </div>
          {err && <p className="mt-4 text-[12px] text-[#FF6537]">{err}</p>}
        </form>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className="rounded-full bg-[#C5F04D] text-[#0F0F11] px-4 py-1.5 text-[11px] font-extrabold tracking-[0.08em]">{paper.state}</span>
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6C6C74]">{paper.outcome} @ {paper.price} · size {paper.qty} · left {paper.remaining}</span>
            <button onClick={() => { setPaper(null); setBookLine("Waiting for first book read…"); }} className="ml-auto font-mono text-[11px] tracking-[0.2em] uppercase text-[#A0A0AB] hover:text-[#EEEEEF] transition-colors">Reset</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-[#2A2A2F] bg-[#0F0F11] p-4">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6C6C74] mb-2">This window</p>
              <p className="font-mono text-sm">{short(paper.oldId)}</p>
              <p className="font-mono text-3xl tabular-nums mt-2">{left(new Date(Number(paper.expiry) * 1000).toISOString())}</p>
            </div>
            <div className="rounded-xl border border-[#2A2A2F] bg-[#0F0F11] p-4">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6C6C74] mb-2">Next window</p>
              <p className="font-mono text-sm">{paper.newId ? short(paper.newId) : "waiting for lock"}</p>
              <p className="font-mono text-3xl tabular-nums mt-2">{paper.newExpiry ? left(new Date(Number(paper.newExpiry) * 1000).toISOString()) : "—"}</p>
            </div>
          </div>
          <p className="text-[12px] text-[#A0A0AB] leading-relaxed mb-2">{bookLine}</p>
          {paper.note && <p className="text-[12px] text-[#EEEEEF] leading-relaxed rounded-xl bg-[#0F0F11] border border-[#2A2A2F] px-4 py-3">{paper.note}</p>}
        </div>
      )}
    </div>
  );
}

export function RelayConsole() {
  const [health, setHealth] = useState<Health>();
  const [feed, setFeed] = useState<Feed>();
  const [tab, setTab] = useState<"live" | "demo">("live");
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

  return (
    <main className="min-h-screen bg-[#0F0F11] text-[#EEEEEF] antialiased">
      <header className="border-b border-[#2A2A2F]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="font-extrabold tracking-tight text-xl" style={{ fontFamily: "Syne, sans-serif" }}>
            REL<GlowWord>AY</GlowWord>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden sm:inline font-mono text-[11px] tracking-[0.2em] text-[#6C6C74] uppercase">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#C5F04D]" />
              SHANNON TESTNET · BUY-ONLY
            </span>
            <a href="#demo" className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#A0A0AB] hover:text-[#EEEEEF] transition-colors">Demo</a>
            <a href="#proof" className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#A0A0AB] hover:text-[#EEEEEF] transition-colors">Proof</a>
            <a href="https://github.com/ronkenx9/relay" target="_blank" rel="noreferrer" className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#A0A0AB] hover:text-[#EEEEEF] transition-colors">GitHub</a>
          </div>
        </div>
      </header>

      <section className="px-6 pt-20 pb-24 md:pt-28">
        <div className="max-w-6xl mx-auto grid gap-14 md:grid-cols-[1.4fr_0.9fr] items-end">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-[#6C6C74] uppercase mb-6">DreamDEX Event Contracts · Somnia Shannon 50312</p>
            <h1 className="font-extrabold tracking-tight leading-[0.95] text-5xl md:text-7xl mb-6" style={{ fontFamily: "Syne, sans-serif" }}>
              Set the price.<br />
              <span style={{ WebkitTextStroke: "2px #EEEEEF", color: "transparent" }}>Keep the intent.</span>
            </h1>
            <p className="text-[#A0A0AB] text-lg leading-relaxed mb-8 max-w-xl">
              Pick a side, name your price, walk away. When the round ends, your order moves into the next one by itself instead of dying. Bet once — it keeps working every round until it hits.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#demo" className="inline-flex items-center gap-2 rounded-full bg-[#C5F04D] px-6 py-3 text-sm font-semibold text-[#0F0F11] transition-all hover:scale-95 active:scale-90 hover:bg-[#EEEEEF]">
                Try it paper <ArrowDown size={15} />
              </a>
              <a href="#proof" className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2F] px-6 py-3 text-sm font-semibold text-[#EEEEEF] transition-all hover:scale-95 active:scale-90 hover:bg-[#C5F04D] hover:text-[#0F0F11] hover:border-[#C5F04D]">
                Read the proof <ArrowUpRight size={15} />
              </a>
            </div>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6C6C74] mt-8">Your queue survives the lobby · Chain 50312 · Testnet only</p>
          </div>
          <div className="rounded-2xl border border-[#2A2A2F] bg-[#1A1A1E] p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#6C6C74]">Current window</p>
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#C5F04D]">{feed ? "Live" : "Connecting"}</span>
            </div>
            <p className="font-extrabold text-4xl tracking-tight mb-1" style={{ fontFamily: "Syne, sans-serif" }}>
              {market?.asset || "—"} <span className="text-[#6C6C74] text-2xl">/ {market ? cadence(market.intervalSec) : "—"}</span>
            </p>
            <p className="font-mono text-xs text-[#A0A0AB] mb-5">{market ? short(market.marketId) : "discovering live markets"}</p>
            <p className="font-mono text-5xl tabular-nums tracking-tight mb-5">{expLeft(market?.expiry)}</p>
            <div className="border-t border-[#2A2A2F] pt-4 grid gap-2 font-mono text-[11px] text-[#A0A0AB]">
              <div className="flex justify-between"><span>OPERATOR</span><span className="text-[#EEEEEF]">{market?.operatorId ?? "—"}</span></div>
              <div className="flex justify-between"><span>STATUS</span><span className="text-[#EEEEEF]">{market?.status || "—"}</span></div>
              <div className="flex justify-between"><span>VENUE</span><span className="text-[#EEEEEF]">{short(market?.venueId)}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-28">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-3 gap-4">
          {[
            { n: "01", title: "Pick a side", body: "BTC goes up this round — yes or no. Same as any prediction market." },
            { n: "02", title: "Name your price", body: "“I take YES at 60 cents.” Nobody has to take it right now." },
            { n: "03", title: "Walk away", body: "Round ends, your leftover moves to the next one by itself. Once. Then it stops." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-[#2A2A2F] bg-[#1A1A1E] p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#C5F04D] mb-3">{s.n}</p>
              <p className="font-bold tracking-tight text-lg mb-2" style={{ fontFamily: "Syne, sans-serif" }}>{s.title}</p>
              <p className="text-sm text-[#A0A0AB] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="demo" className="px-6 py-28 border-t border-[#2A2A2F]">
        <div className="max-w-6xl mx-auto">
          <p className="font-mono text-xs tracking-[0.2em] text-[#6C6C74] uppercase mb-6">Live relay lane</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6" style={{ fontFamily: "Syne, sans-serif" }}>Watch it survive a round.</h2>
          <p className="text-[#A0A0AB] text-lg leading-relaxed mb-8 max-w-2xl">Paper demo runs on live testnet markets with no wallet. The operator lane below it is the real machine — read-only until a funded signer is configured.</p>
          <div className="flex gap-2 mb-6">
            {(["live", "demo"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2.5 text-[11px] font-extrabold tracking-[0.08em] transition-all hover:scale-95 active:scale-90 ${tab === t ? "bg-[#C5F04D] text-[#0F0F11]" : "border border-[#2A2A2F] text-[#A0A0AB] hover:text-[#EEEEEF]"}`}>
                {t === "live" ? "OPERATOR LANE" : "PAPER DEMO"}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-[#2A2A2F] bg-[#1A1A1E]">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#2A2A2F]">
              <div className="flex items-center gap-2 text-[13px] font-bold tracking-wide"><Radio size={15} className="text-[#C5F04D]" /> {tab === "live" ? "LIVE RELAY LANE" : "PAPER RELAY LANE"}</div>
              <span className="font-mono text-[10px] tracking-[0.2em] text-[#6C6C74] uppercase">{feed ? `Refreshed ${new Date(feed.observedAt).toLocaleTimeString()}` : "Connecting"}</span>
            </div>
            {tab === "demo" ? <DemoTab markets={markets} /> : (
            <div className="p-6">
              <form onSubmit={arm}>
                <select aria-label="Market series" value={market?.marketId || ""} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-xl border border-[#2A2A2F] bg-[#0F0F11] px-4 py-3 text-sm text-[#EEEEEF] mb-6 focus:outline-none focus:border-[#C5F04D]">
                  {markets.length ? markets.map((item) => <option key={item.marketId} value={item.marketId}>{item.asset} · {cadence(item.intervalSec)} · ends {expTime(item.expiry)}</option>) : <option>Discovering live markets…</option>}
                </select>
                <div className="grid sm:grid-cols-3 gap-px rounded-xl overflow-hidden border border-[#2A2A2F] mb-6 bg-[#2A2A2F]">
                  <div className="bg-[#C5F04D] text-[#0F0F11] px-4 py-3 text-[11px] font-extrabold tracking-wide">REST UNTIL LOCK<span className="block font-medium opacity-70 mt-1">Normal limit order, no IOC.</span></div>
                  <div className="bg-[#1A1A1E] text-[#EEEEEF] px-4 py-3 text-[11px] font-extrabold tracking-wide">VERIFY SUCCESSOR<span className="block font-medium text-[#A0A0AB] mt-1">Same question, next window, proven onchain.</span></div>
                  <div className="bg-[#1A1A1E] text-[#EEEEEF] px-4 py-3 text-[11px] font-extrabold tracking-wide">RESTATE REMAINDER<span className="block font-medium text-[#A0A0AB] mt-1">Leftover moves once. Then it stops.</span></div>
                </div>
                <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                  <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[#6C6C74]">Outcome
                    <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="mt-2 block w-full rounded-xl border border-[#2A2A2F] bg-[#0F0F11] px-4 py-3 text-sm text-[#EEEEEF] focus:outline-none focus:border-[#C5F04D]"><option>YES</option><option>NO</option></select>
                  </label>
                  <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[#6C6C74]">Limit price
                    <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-2 block w-full rounded-xl border border-[#2A2A2F] bg-[#0F0F11] px-4 py-3 text-sm text-[#EEEEEF] focus:outline-none focus:border-[#C5F04D]" />
                  </label>
                  <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-[#6C6C74]">Quantity
                    <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-2 block w-full rounded-xl border border-[#2A2A2F] bg-[#0F0F11] px-4 py-3 text-sm text-[#EEEEEF] focus:outline-none focus:border-[#C5F04D]" />
                  </label>
                  <button disabled={!canArm} className="rounded-full bg-[#EEEEEF] px-6 py-3 text-[11px] font-extrabold tracking-[0.08em] text-[#0F0F11] transition-all hover:scale-95 active:scale-90 hover:bg-[#C5F04D] disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]">ARM TESTNET INTENT</button>
                </div>
              </form>
              <p className="mt-5 text-[12px] leading-relaxed text-[#6C6C74]">{message} Price and size snap to the discovered market grid before any order can be sent.</p>
            </div>
            )}
          </div>
        </div>
      </section>

      <section id="proof" className="px-6 py-28 border-t border-[#2A2A2F]">
        <div className="max-w-6xl mx-auto grid gap-12 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-[#6C6C74] uppercase mb-6">Execution proof</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6" style={{ fontFamily: "Syne, sans-serif" }}>Every claim has a receipt.</h2>
            <p className="text-[#A0A0AB] text-lg leading-relaxed mb-8">Real Shannon transactions. Your leftover moved from one window to the next — same question, same price, one move, then stop.</p>
            <div className="rounded-2xl border border-[#2A2A2F] bg-[#1A1A1E] divide-y divide-[#2A2A2F]">
              {PROOF_TXS.map((tx) => (
                <a key={tx.hash} href={`${EXPLORER}${tx.hash}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 px-5 py-4 transition-all hover:scale-[0.99] hover:bg-[#0F0F11] group">
                  <div><p className="text-sm font-semibold">{tx.label}</p><p className="font-mono text-[11px] text-[#6C6C74]">{short(tx.hash)}</p></div>
                  <ArrowUpRight size={16} className="shrink-0 text-[#6C6C74] group-hover:text-[#C5F04D] transition-colors" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-[#6C6C74] uppercase mb-6">Console health</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6" style={{ fontFamily: "Syne, sans-serif" }}>Safe by default.</h2>
            <p className="text-[#A0A0AB] text-lg leading-relaxed mb-8">Read-only until a funded testnet signer is configured server side. No browser key custody. Winnings are between you and DreamDEX — RELAY never touches them.</p>
            <div className="rounded-2xl border border-[#2A2A2F] bg-[#1A1A1E] divide-y divide-[#2A2A2F]">
              {[["Network", health?.network || "Checking"], ["Contracts", health?.deployment || "Checking"], ["Signer", health?.signer || "Checking"], ["Ledger", health?.persistence || "Checking"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-5 py-4 text-sm"><span className="text-[#6C6C74]">{k}</span><b className="text-right break-all font-semibold">{v}</b></div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-[#C5F04D] text-[#0F0F11] p-6">
              <p className="font-mono text-[11px] tracking-[0.2em] uppercase mb-2 opacity-70">Guardrail</p>
              <p className="font-bold tracking-tight" style={{ fontFamily: "Syne, sans-serif" }}>If the next window looks wrong, your money stays put. The runner never passes to a stranger.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-28 border-t border-[#2A2A2F]">
        <div className="max-w-6xl mx-auto">
          <p className="font-mono text-xs tracking-[0.2em] text-[#6C6C74] uppercase mb-6">Why it is safe to walk away</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-12" style={{ fontFamily: "Syne, sans-serif" }}>Bounded by design.</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: ShieldCheck, title: "One bet, never two", body: "Your leftover moves once into the next window. No re-betting after a loss, no doubling down, ever." },
              { icon: BadgeCheck, title: "Right window or nothing", body: "Same question, next time slot, proven onchain. Anything ambiguous and your money stays put." },
              { icon: RotateCw, title: "Your winnings are yours", body: "If your price gets taken and the round resolves for you, redeem with DreamDEX directly. RELAY takes no cut." },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-[#2A2A2F] bg-[#1A1A1E] p-6 transition-all hover:scale-[0.98] hover:border-[#C5F04D]">
                <c.icon size={18} className="text-[#C5F04D] mb-4" />
                <p className="font-bold tracking-tight mb-2" style={{ fontFamily: "Syne, sans-serif" }}>{c.title}</p>
                <p className="text-sm text-[#A0A0AB] leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-12 border-t border-[#2A2A2F]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] tracking-[0.2em] uppercase text-[#6C6C74]">
          <span>RELAY · Shannon 50312 · Your queue survives the lobby</span>
          <div className="flex gap-5">
            <a href="https://dorahacks.io/hackathon/event-contracts/detail" target="_blank" rel="noreferrer" className="hover:text-[#EEEEEF] transition-colors">DoraHacks</a>
            <a href="https://docs.dreamdex.io/developers/event-contracts" target="_blank" rel="noreferrer" className="hover:text-[#EEEEEF] transition-colors">Docs</a>
            <a href="https://github.com/ronkenx9/relay" target="_blank" rel="noreferrer" className="hover:text-[#EEEEEF] transition-colors">Repo</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
