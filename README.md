# RELAY

RELAY is a production operator console for a tightly bounded Somnia Shannon testnet experiment: place one normal limit order in a binary-market window, track its unfilled remainder, and only roll once after independently verifying a successor market.

## What is live

- Live Shannon testnet market discovery and contract health checks.
- Durable D1 schema for intents, market hops, and evidence events.
- Protected control and worker endpoints, designed to keep private keys out of the browser.
- A read-only console by default.

## Deliberate activation gate

This app does **not** send market orders until a dedicated, funded Shannon testnet signer completes qualification. Configure these server-side variables through the host control plane; never expose them in client code:

```text
RELAY_PRIVATE_KEY=0x...      # dedicated Shannon testnet wallet only
RELAY_CONTROL_TOKEN=...      # protects POST /api/intents
RELAY_WORKER_TOKEN=...       # protects POST /api/worker/tick
RELAY_MAX_COLLATERAL=10
RELAY_MAX_QUANTITY=10
```

The dashboard is intentionally not a key-entry screen. An external scheduler may call the worker endpoint using its protected token after signer qualification.

## Development

```bash
npm install
npm run db:generate
npm run dev
```

Run `npm run build && npm run lint` before deployment.

## Operator activation

See [RUNBOOK.md](RUNBOOK.md) for the one-order qualification, reconciliation, rollover, pause/recovery, and evidence procedure. Never add a private key to the repository or browser bundle.
