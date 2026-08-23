# RELAY operator runbook

## Activation prerequisites

1. Create a dedicated Shannon **testnet-only** wallet. Do not reuse a personal or mainnet key.
2. Fund it with enough STT for gas and test USDC for a deliberately tiny order.
3. Set `RELAY_PRIVATE_KEY`, `RELAY_CONTROL_TOKEN`, and `RELAY_WORKER_TOKEN` as host secrets. Set `RELAY_MAX_COLLATERAL` and `RELAY_MAX_QUANTITY` to tiny decimal caps.
4. Deploy after the environment revision. The health endpoint must report `network: SHANNON TESTNET`, `deployment: verified`, `signer: ready`, and `persistence: D1 durable ledger`.
5. Configure the repository scheduler secrets: `RELAY_WORKER_URL`, `RELAY_WORKER_TOKEN`, and a Sites bypass token as `RELAY_SITES_BYPASS_TOKEN`. The included GitHub Action ticks every five minutes and has no repository permissions.

## Qualification order

1. Select a current BTC/ETH market and set a non-marketable normal limit price.
2. Arm one intent through `POST /api/intents` using the control token.
3. Call `POST /api/worker/tick` with the worker token. Record the transaction hash and order ID.
4. Call the tick again. It must report `ACTIVE` with the same order ID and a chain-read remainder.
5. Exercise `POST /api/intents/{intentId}/cancel` with the control token, then confirm the cancellation receipt and paused ledger state. Re-arm before proceeding.
6. Let a second non-marketable order expire; confirm the terminal result from chain/indexer before any successor work.
7. Run one 60-second/5-minute rollover with a nonzero proven remainder. Confirm one successor hop only, exact series identity, an on-chain Trading successor, and a distinct market ID.

## Safety response

- If a tick reports `PLACING`/`PAUSED`, do not resend. Reconcile the order from its transaction hash and pool/order ID first.
- If source identity, expiry, or direct successor is ambiguous, keep the intent paused.
- If the run proves a defect, remove `RELAY_PRIVATE_KEY` from the host to return immediately to read-only mode.

## Evidence package

Keep a redacted JSON export containing: intent ID, series key, source/destination market IDs, pool+nonce evidence, transaction hashes, order IDs, raw remaining quantities, and timestamps. Capture a short uncut rollover video and link it in the public README before submission.
