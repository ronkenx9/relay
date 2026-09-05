# RELAY — Bet once. It keeps working every round until it hits.

**Live demo:** https://relay-r4gm9okrs-ronins-projects-c7d07daa.vercel.app (paper demo tab needs no wallet)

DreamDEX Event Contracts ask the same question on a schedule — "BTC up in the next 5 min?" at 12:00, then again at 12:05, 12:10, and so on. Each window is its own market with its own order book. Your order only lives in one. When the round ends, it dies there, and today you come back every 5 minutes to rebuild it by hand — like feeding a parking meter.

RELAY feeds the meter for you. Pick a side, name your price, walk away. If nobody takes your offer before the round ends, your leftover moves into the next window by itself — same question, same price. Once. Then it stops. Your queue survives the lobby.

> **Hackathon:** Somnia × DreamDEX Event Contracts — [DoraHacks](https://dorahacks.io/hackathon/event-contracts/detail) · Submission Aug 25 → Sep 8 19:00 · Prize $5,000 USDso
> **Network:** Shannon testnet only — `chainId 50312` · SDK `@somnia-chain/markets-sdk@0.28.0` · Test collateral `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` (6 decimals)
> **Video:** 2–3 min demo (link before submission) · **Repo:** this repo (`ronkenx9/relay`)

## Try it (no wallet)

Open the live demo, switch to the **Paper demo** tab, pick a live market, set a side and price, and watch. It reads the real testnet order book every 5 seconds: if the book reaches your price you get filled, and when the window closes your leftover carries into the verified next window. Nothing moves, nothing is spent — it is a simulation against live markets, clearly labeled. The operator lane beside it is the real machine, read-only until a funded signer is configured.

## What it is not

- Not repeated betting. One order, placed once. It never bets again after a loss, never chases, never doubles down. If your price gets taken and the round resolves against you, RELAY does nothing — it is done.
- Not every market. The leftover moves into one specific window only: the same asset, same length, next time slot. Not ETH when you bet BTC, not the 15-minute window when you bet the 5-minute one.
- Not your winnings. If your price gets taken and you win, redeeming is between you and DreamDEX. RELAY never touches profit, takes no cut, reinvests nothing.

## Why it is safe to walk away

Moving money between windows is dangerous — hand it to the wrong window and it is gone. So before moving a cent, RELAY proves the next window is the real continuation (same operator, venue, asset and cadence — what we call the SeriesKey), confirmed tradable onchain with matching expiry and pool binding. It moves only what is left over, at most once, and if anything looks ambiguous it holds your money and waits. Like a relay runner who will not pass the baton to a stranger.

This is also what separates RELAY from the official `ec-passive` sample bot: that bot follows each new window but **restarts its position from zero** — your leftover is discarded. RELAY **carries the remainder**, with proof the continuation is legitimate. The protocol gives you the next lobby; nothing in it keeps you queued.

## Live proof — verified Shannon transactions

All hashes below are real Shannon `50312` transactions. Explorer: `https://shannon-explorer.somnia.network/tx/<hash>`

**Signer (dedicated testnet-only):** `0xA991887769D59B390ad30102CF1C865394aC333f` — funded 50 STT, `0x70a86...` testUSDC via faucet

| Step | Market | Pool | Tx | OrderId | Explorer |
|---|---|---|---|---|---|
| **Faucet** 10k testUSDC | — | `0x70a86D884...` | `0x2ef2806464c982747359c8611b64d1f5121d69499ffaf51baf090dd95cd49240` | `success` | [tx](https://shannon-explorer.somnia.network/tx/0x2ef2806464c982747359c8611b64d1f5121d69499ffaf51baf090dd95cd49240) |
| **Place** `BUY_YES 0.10 x 1` (15m ETH, DreamDEX) | `0x...2591` expiry `1788510300` | `0x3e35f705bde5f826083621abe3d37ab8979e52fb` | `0x530560b008164f67bcc6fd6f867a7579dd270f0fd4038be264fdf00f67c59e4f` | `110680464442257499721` | [tx](https://shannon-explorer.somnia.network/tx/0x530560b008164f67bcc6fd6f867a7579dd270f0fd4038be264fdf00f67c59e4f) |
| **Cancel** same order | same | same | `0xaa2b165dd9e486d736dcecedf38fbfdf9dd1ab15abe2d2966968ad214c0a2b2f` | — | [tx](https://shannon-explorer.somnia.network/tx/0xaa2b165dd9e486d736dcecedf38fbfdf9dd1ab15abe2d2966968ad214c0a2b2f) |
| **Rollover old** `BUY_YES 0.10 x 1` (BTC 300s DreamDEX) | `0x...1318c` expiry `1788510300` | `0x4abb885682402039a5d50b542ad30ae305898963` | `0x6bfe9b2ffb9f1085a08af228ebb2b546f381b466043da76241ac94bba84ab1b8` | `18446744073709838331` | [tx](https://shannon-explorer.somnia.network/tx/0x6bfe9b2ffb9f1085a08af228ebb2b546f381b466043da76241ac94bba84ab1b8) |
| **Rollover new** remainder `0.10 x 1` on successor | `0x...1319a` expiry `1788510600` (+300s) | `0x034c3e6fbc87e01a8ee4f5de03f3535777ab6faa` | `0xacdc16ded8a862201bbc918af1f52b1bed54bfd5bf8aafd8edfe38ffb07dd8be` | `36893488147419108984` | [tx](https://shannon-explorer.somnia.network/tx/0xacdc16ded8a862201bbc918af1f52b1bed54bfd5bf8aafd8edfe38ffb07dd8be) |
| **Cleanup** cancel successor | same as new | same | `0x4153454d5c23004fd32c986af95c140ccf3860fcbbf8cb7f456e0d6da6a2efc3` | — | [tx](https://shannon-explorer.somnia.network/tx/0x4153454d5c23004fd32c986af95c140ccf3860fcbbf8cb7f456e0d6da6a2efc3) |

**What this proves:** onchain `Trading` status plus pool/expiry cross-checks before every write; the 0.10 price provably rested (book was YES 0.676/0.704); old and new windows have **distinct market ids** with the **same series** and **exactly one** remainder order between them.

## How it works (operator lane)

**Arm.** Pick a live BTC/ETH window, choose YES or NO, a limit price and size. The UI shows best bid/ask, max escrow, market id, pool and countdown. Server-side caps (`RELAY_MAX_COLLATERAL` / `RELAY_MAX_QUANTITY`) always apply.

**Rest.** The worker re-validates everything (chain `50312`, deployment code, series identity, future expiry, onchain `Trading`, balances, grid alignment), then places one normal limit order. Receipt, order id, fills and aligned price/quantity are persisted to the ledger.

**Roll.** At lock the worker finds the successor (same series, smallest later expiry, unambiguous), verifies it onchain, and places the proven remainder exactly once. Ambiguity, missing venue, or an unverified candidate means `PAUSED` — never a guess. A crash between send and receipt means reconcile-first, never blind resend.

**Prove.** The Proof section shows old/new windows side by side with explorer links, and the evidence endpoint exports redacted JSON (build commit, SDK version, series, both market identities, both tx hashes, amounts, timings — no secrets).

Full spec: `PRD.md` §6.3 · resources and gate ledger: `RESOURCES.md` · milestones: `PLAN.md`.

## Architecture

```
Landing + paper demo (React, live testnet reads, no wallet)
Operator lane (Next.js, control-token protected writes)
      │ HTTP
      ▼
Serialized relay worker ──→ SQLite/Turso event + state store
      │
      ├─ Somnia Markets SDK 0.28.0: discovery, books, live tail, trader writes
      ├─ Shannon indexer: market discovery/history
      └─ Shannon RPC/WS: chain truth, receipts
```

One active intent, one serialized write lane, `unique (intentId, destinationMarketId)`, buy-only, one automatic rollover. Testnet-only guard (`eth_chainId === 50312`) on every write path.

## Verified configuration

| Item | Value |
|---|---|
| Chain | `50312` (`0xc488`) |
| RPC | `https://api.infra.testnet.somnia.network` |
| Indexer | `https://dev.smk.somnia.host/v1/graphql` |
| SDK | `@somnia-chain/markets-sdk@0.28.0` + `viem@^2` |
| Collateral | `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` (6d) |
| BinaryModule | `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| Explorer | `https://shannon-explorer.somnia.network` |

## Development

```bash
npm install
npm run db:generate
npx next dev            # local Next.js dev (Vercel target)
npm run build && npm run lint   # vinext/Sites flow still supported
```

Node `>=22.13.0`, TypeScript strict. Live Shannon tests are opt-in with tiny caps and never run in CI without a funded signer. `vercel.json` pins `next build` for Vercel; the deployed URL above is the submission demo.

## Operator activation

Read-only until host secrets are set. **Never put a private key in the repo or browser.**

```text
RELAY_PRIVATE_KEY=0x...      # dedicated Shannon testnet wallet only
RELAY_CONTROL_TOKEN=...      # protects POST /api/intents
RELAY_WORKER_TOKEN=...       # protects POST /api/worker/tick
RELAY_MAX_COLLATERAL=10
RELAY_MAX_QUANTITY=10
TURSO_URL=...                # ledger database (libsql)
TURSO_AUTH_TOKEN=...         # remote Turso only
```

Full procedure: `RUNBOOK.md` (qualification order, reconciliation, pause/recovery, evidence). Local dev signer lives in macOS Keychain `RELAY_SHANNON_TESTNET_KEY`; `.dev.vars` is gitignored.

## Submission checklist (Sep 8 19:00)

* [x] Working prototype on Shannon testnet — place/cancel plus full 300s rollover (txs above)
* [x] Public demo URL with paper tab (no wallet needed)
* [ ] Final 15m rollover capture for hero video
* [x] GitHub repo with spin-up instructions (this file)
* [ ] 2–3 min demo video (problem → arm → roll → restate → why Event Contracts)
* [ ] SDK/docs feedback report
* [ ] Evidence bundle redacted JSON attached
* Owner final click on DoraHacks after review

## SDK & docs feedback (in progress)

Against `0.28.0` with repro steps — filed under `/docs/feedback.md` before submission. Venue IDs move between releases so runtime enumeration is mandatory; binary order expiry defaults to market expiry; indexer status alone lags, so the onchain gate is essential.

## Limitations (honest)

Testnet only, buy-only, one intent, one rollover. No sells, no multi-roll, no portfolio PnL, no oracle operation. Question text is never parsed. Immediate pool reuse is observed, never assumed. Exactly-once after an unobservable crash is pause/reconcile, not a guaranteed dedup.

## Links

* Hackathon: https://dorahacks.io/hackathon/event-contracts/detail
* Docs: https://docs.dreamdex.io/developers/event-contracts
* Bot kit: https://github.com/somnia-chain/dreamdex-bot-kit (behavioral reference only — no kit code in this repo)
* Starter template: https://github.com/IronicDeGawd/ec-dreamdex-hackathon-template
* Telegram: https://t.me/+XHq0F0JXMyhmMzM0
* Testnet portal/faucet: https://testnet.somnia.network/

---

MIT — Built for Somnia × DreamDEX. Relay what remains.
