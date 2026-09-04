# RELAY — Persistent intent across DreamDEX Event Contract windows

**One limit order that survives its market.** DreamDEX binary Event Contracts expire on a schedule. A resting order dies with its `marketId`. RELAY keeps the unfilled remainder working for one verified successor window — same price, same outcome, exactly once, with every transition proven on Shannon testnet.

> **Hackathon:** Somnia × DreamDEX Event Contracts — [DoraHacks](https://dorahacks.io/hackathon/event-contracts/detail) · Submission Aug 25 → Sep 8 19:00 · Prize $5,000 USDso
> **Network:** Shannon testnet only — `chainId 50312` · SDK `@somnia-chain/markets-sdk@0.28.0` · Test collateral `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` (6 decimals)
> **Video:** 2–3 min demo (link after final 15m capture) · **Repo:** this repo + public mirror at `ronkenx9/relay`

---

## Live proof — verified Shannon transactions

All hashes below are real Shannon `50312` transactions. Explorer: `https://shannon-explorer.somnia.network/tx/<hash>`

**Signer (dedicated testnet-only):** `0xA991887769D59B390ad30102CF1C865394aC333f` — funded 50 STT, `0x70a86...` testUSDC via faucet

| Step | Market | Pool | Tx | OrderId | Explorer |
|---|---|---|---|---|---|
| **Faucet** 10k testUSDC | — | `0x70a86D884...` | `0x2ef2806464c982747359c8611b64d1f5121d69499ffaf51baf090dd95cd49240` | `success` | [tx](https://shannon-explorer.somnia.network/tx/0x2ef2806464c982747359c8611b64d1f5121d69499ffaf51baf090dd95cd49240) |
| **P2 place** `BUY_YES 0.10 x 1` (15m ETH, DreamDEX) | `0x...2591` expiry `1788449400` | `0x3e35f705bde5f826083621abe3d37ab8979e52fb` | `0x530560b008164f67bcc6fd6f867a7579dd270f0fd4038be264fdf00f67c59e4f` | `110680464442257499721` | [tx](https://shannon-explorer.somnia.network/tx/0x530560b008164f67bcc6fd6f867a7579dd270f0fd4038be264fdf00f67c59e4f) |
| **P2 cancel** same order | same | same | `0xaa2b165dd9e486d736dcecedf38fbfdf9dd1ab15abe2d2966968ad214c0a2b2f` | — | [tx](https://shannon-explorer.somnia.network/tx/0xaa2b165dd9e486d736dcecedf38fbfdf9dd1ab15abe2d2966968ad214c0a2b2f) |
| **P4 old** `BUY_YES 0.10 x 1` (BTC 300s DreamDEX) | `0x...1318c` expiry `1788510300` | `0x4abb885682402039a5d50b542ad30ae305898963` | `0x6bfe9b2ffb9f1085a08af228ebb2b546f381b466043da76241ac94bba84ab1b8` | `18446744073709838331` | [tx](https://shannon-explorer.somnia.network/tx/0x6bfe9b2ffb9f1085a08af228ebb2b546f381b466043da76241ac94bba84ab1b8) |
| **P4 new** remainder `0.10 x 1` on successor | `0x...1319a` expiry `1788510600` (+300s) | `0x034c3e6fbc87e01a8ee4f5de03f3535777ab6faa` | `0xacdc16ded8a862201bbc918af1f52b1bed54bfd5bf8aafd8edfe38ffb07dd8be` | `36893488147419108984` | [tx](https://shannon-explorer.somnia.network/tx/0xacdc16ded8a862201bbc918af1f52b1bed54bfd5bf8aafd8edfe38ffb07dd8be) |
| **cleanup** cancel successor | same as new | same | `0x4153454d5c23004fd32c986af95c140ccf3860fcbbf8cb7f456e0d6da6a2efc3` | — | [tx](https://shannon-explorer.somnia.network/tx/0x4153454d5c23004fd32c986af95c140ccf3860fcbbf8cb7f456e0d6da6a2efc3) |

**What this proves (PRD M1-M6):**

* `onchain status 1` (`Trading`) + pool/expiry cross-checked before every write
* Book at place time was YES `0.676/0.704` — `0.10` is provably non-marketable and rested
* Old → new have **distinct `marketId`**, **same SeriesKey** `operator 2 / venue 0x679795a0... / BTC / 300`, **same price/qty remainder**, **exactly one destination hop** (`unique (intentId, destinationMarketId)`)
* Successor was resolved by indexer discovery + `getMarketOnchain` verification with 250ms→2s backoff, not by pool address

Raw EVM receipts + redacted JSON bundle will be attached under `/docs/evidence/` before submission.

---

## Problem

Prediction markets with scheduled windows break the mental model of a limit order. On DreamDEX Event Contracts, a market is `marketId + pool + nonce + expiry`. When the clock hits `expiry`, the market locks — any resting order on that `marketId` stops working. Traders must watch the lock, find the next market in the same series, and rebuild the same order manually. Liquidity drains at every boundary.

## Solution — why this needs Event Contracts

RELAY is not a generic CLOB terminal. Its entire value disappears if rolling Event Contracts disappear. The primitive is the **SeriesKey**:

```
SeriesKey = operatorId + venueId + asset + intervalSec
MarketGeneration = marketId + onchain.pool + onchain.nonce
```

Given an old market `O`, the **direct successor** is the smallest `expiry > O.expiry` with identical SeriesKey that is authoritatively `Trading` onchain. Pool reuse is observed (`POOL REUSED` badge) but never used for selection — pool is a time-varying binding, not an identity. The interface makes the transition legible: `old marketId → lock observed → successor verified → new marketId → new order tx`.

One-sided buy-only, one active intent, one automatic rollover. If the successor set is ambiguous or unverified, the worker pauses (`PAUSED_SUCCESSOR_NOT_PROVEN`) — it never guesses.

---

## How it works

**1. Arm.** Operator picks a live DreamDEX BTC/ETH market (60s/300s/900s/3600s), chooses `UP/YES` or `DOWN/NO`, limit price (`0 < p < 1`) and quantity. UI shows best bid/ask, max escrow (`price × qty`), marketId, pool, countdown, and one-roll cap. `RELAY_MAX_COLLATERAL` / `RELAY_MAX_QUANTITY` caps are enforced server-side.

**2. Place.** Worker re-validates: chain `50312`, deployment code, SeriesKey, future expiry, onchain `Trading`, STT + collateral balances, SDK grid alignment. Then `trader.placeOrder({pool, side: BUY_YES, price, quantity})` via `realtime_sendRawTransaction` (one round-trip). Receipt is awaited; orderId + fills + aligned price/qty are persisted. Faucet auto-approval is handled by the SDK if allowance is short.

**3. Monitor.** Timeline counts down. The order rests; fills are reconciled from `getOrderOnchain(pool, orderId)` / `getOwnOpenOrdersOnchain`.

**4. Rollover.** At lock, state `LOCK_OBSERVED → FINDING_SUCCESSOR → VERIFYING_SUCCESSOR`. Discovery: `client.listLiveBinaryMarkets` filtered by SeriesKey, exclude `O`, sort by `expiry` then `marketId`, pick smallest later expiry only if unambiguous. Verify: `getMarketOnchain(candidate)` must match `status 1`, `expiry`, and `pool`. Then place exactly one limit buy on the successor for the proven `remaining` (never resend on uncertain write — pause/reconcile).

**5. Prove.** Proof screen shows side-by-side old/new rows, invariant checks, detection latency (`firstCandidateSeenAt → verifiedAt → submittedAt`), explorer links, and `Download evidence` (redacted JSON). No private key or token ever leaves the server.

Details: `PRD.md` §6.3, `RESOURCES.md` §5, `PLAN.md` P0-P7.

## Architecture

```
Focused React UI (Vite + Tailwind)
      │ HTTP + SSE
      ▼
Operator API (Next.js / Fastify) ──────→ SQLite (D1) event/state store
      │                                    ▲
      ▼                                    │
Serialized relay worker ────────────────────┘
      │
      ├─ Somnia Markets SDK 0.28.0: discovery, books, live tail, trader writes
      ├─ Shannon indexer: market discovery/history (https://dev.smk.somnia.host/v1/graphql)
      └─ Shannon RPC/WS: chain truth, receipts (https://api.infra.testnet.somnia.network)
```

**Packages:** `apps/web` — React focused UI · `apps/server` — Fastify API + SSE + worker lifecycle · `packages/core` — pure state machine + successor selector · `packages/somnia` — SDK adapter + probes · `packages/store` — SQLite event log (WAL + process lock). The SDK adapter is the only layer that knows Somnia structs.

**Safety:** testnet-only guard (`eth_chainId === 50312`), one active intent, serialized signer queue, `unique (intentId, destinationMarketId)`, caps, pause on ambiguity, receipt-checked writes, graceful shutdown + crash replay that never blind-resends.

## Screens

* **Arm** — `RELAY / SHANNON 50312` + safety status; current market card (asset, cadence, countdown, marketId, pool, nonce); controls (outcome, price, shares, one-roll disclosure); cost preview + STT/testUSDC balances; `ARM RELAY`.
* **Live lane** — large countdown; target price line vs best bid/ask; timeline `RESTING → LOCKED → FINDING → VERIFIED → RELAYED`; old/new identity cards; fill/remaining; explorer links; `Stop relay`.
* **Proof** — old/new side-by-side, invariant pass/fail, timing, pool-reuse badge, `Download evidence`.

## Submission checklist (Sep 8 19:00)

* [x] Working prototype on Shannon testnet — place → cancel and full 300s rollover proven (txs above)
* [ ] Final 15m BTC/ETH rollover capture for hero video (scheduled next, ~7 min wait)
* [ ] Architecture diagram + screenshots
* [x] GitHub repo with spin-up instructions (this file)
* [ ] 2–3 min demo video (PRD §17 script: problem 0:00-0:25 → arm 0:25-0:55 → roll 0:55-1:35 → restate 1:35-2:05 → why Event Contracts 2:05-2:30)
* [ ] SDK/docs feedback report (collecting during P4/P6)
* [ ] Evidence bundle redacted JSON + receipts linked
* Owner final click on DoraHacks after review

## Verified configuration

| Item | Value |
|---|---|
| Chain | `50312` (`0xc488`) |
| RPC | `https://api.infra.testnet.somnia.network` |
| WS | `wss://api.infra.testnet.somnia.network/ws` |
| Indexer | `https://dev.smk.somnia.host/v1/graphql` |
| SDK | `@somnia-chain/markets-sdk@0.28.0` + `viem@^2` |
| Collateral | `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` (6d) |
| BinaryModule | `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| Explorer | `https://shannon-explorer.somnia.network` |

Startup verifies `eth_chainId`, `eth_getCode` for both contracts, venue pair enumeration, live market + onchain `Trading`, signer funding. See `RESOURCES.md` for the full gate ledger.

## Development

```bash
npm install
npm run db:generate
npm run dev          # vite + cloudflare, http://localhost:5173
npm run build && npm run lint
```

Node `>=22.13.0`, TypeScript strict, Vitest + Playwright. Live Shannon tests are opt-in and use tiny caps; they never run in CI without a funded signer.

## Operator activation

This app is read-only until host secrets are set. **Never put a private key in the repo or browser.**

```text
RELAY_PRIVATE_KEY=0x...      # dedicated Shannon testnet wallet only
RELAY_CONTROL_TOKEN=...      # protects POST /api/intents
RELAY_WORKER_TOKEN=...       # protects POST /api/worker/tick
RELAY_MAX_COLLATERAL=10
RELAY_MAX_QUANTITY=10
```

Via host control plane (Sites/Wrangler secrets), then deploy. Health must report `network: SHANNON TESTNET`, `deployment: verified`, `signer: ready`, `persistence: D1 durable ledger`. Configure repo scheduler secrets `RELAY_WORKER_URL`, `RELAY_WORKER_TOKEN`, `RELAY_SITES_BYPASS_TOKEN` — the included GitHub Action ticks every 5 min.

Full procedure: `RUNBOOK.md` (qualification order, reconciliation, pause/recovery, evidence).

Current signer `0xA991887769D59B390ad30102CF1C865394aC333f` lives in macOS Keychain `RELAY_SHANNON_TESTNET_KEY`; `.dev.vars` is gitignored and holds the local dev binding.

## Tests & verification

* **Unit:** SeriesKey equality, successor ordering/ambiguity, same/different pool, remainder arithmetic, decimal validation, state machine, `unique` hop, redaction.
* **Integration:** indexer-lags-chain, chain-lags-indexer, missing venue, full/partial fill, crash before/after send, outage recovery, duplicate worker lock, wrong chain.
* **Live gates (proven):** chain `50312`, deployment code, funded signer (50 STT + 10k testUSDC), tiny place-read-cancel (`0x5305...` → `0xaa2b...`), full 300s rollover with distinct `marketId`s and one hop (`0x6bfe...` → `0xacdc...`), evidence bundle matches explorer, clone-to-read-only.

## SDK & docs feedback (in progress)

Collecting against `0.28.0` with repro steps — to be filed under `/docs/feedback.md` before submission:
* Venue IDs moved between bot-kit commits; runtime enumeration is mandatory.
* Binary order expiry defaults to market expiry (not 50y) — correct but needs docs emphasis.
* `watchMarkets({discover:true})` + `getMarketOnchain` gate is essential; indexer `clobStatus` alone lags.
* Pool reuse is real but not immediate; `marketId` must be the key.

## Limitations (honest)

* Testnet only, buy-only, one intent, one rollover. No sells, no multi-roll, no portfolio PnL, no oracle operation.
* Question text is never parsed; venue scope is runtime-enumerated.
* IOC/post-only are not the persistent quote — normal limit (`GTC` bounded by market expiry) is the core.
* Exactly-once after an unobservable crash is pause/reconcile, not a guaranteed dedup.

## Links

* Hackathon: https://dorahacks.io/hackathon/event-contracts/detail
* Docs: https://docs.dreamdex.io/developers/event-contracts
* Bot kit (`9718fd9`): https://github.com/somnia-chain/dreamdex-bot-kit
* Bot builder: https://dreambot-builder.vercel.app/
* Starter template: https://github.com/IronicDeGawd/ec-dreamdex-hackathon-template
* Telegram: https://t.me/+XHq0F0JXMyhmMzM0
* Testnet portal/faucet: https://testnet.somnia.network/

---

MIT — Built for Somnia × DreamDEX. Relay what remains.

