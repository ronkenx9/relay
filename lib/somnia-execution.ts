import { SOMNIA_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { assertBoundedIntent, decimalToUnits, snapDown } from "./relay-core";
import { SHANNON, type LiveMarket } from "./somnia";

export type SignerConfig = { privateKey: `0x${string}`; maxCollateral: string; maxQuantity: string };
export type PlacedOrder = { hash: string; orderId: string | null; price: string; quantity: string; filled: string; remaining: string; pool: string; nonce: string };

function exchange(privateKey: `0x${string}`) {
  return new SomniaMarkets({ chain: somniaShannon, wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws", indexerUrl: SHANNON.indexer, addresses: SOMNIA_TESTNET_ADDRESSES, privateKey });
}

export async function assertTradableMarket(privateKey: `0x${string}`, market: LiveMarket) {
  const sdk = exchange(privateKey);
  try {
    const onchain = await sdk.client.getMarketOnchain(market.marketId as Hex);
    if (onchain.status !== 1) throw new Error(`Market is not Trading (status ${onchain.status}).`);
    if (onchain.expiry <= BigInt(Math.floor(Date.now() / 1000))) throw new Error("Market has already expired.");
    return { sdk, onchain };
  } catch (error) { sdk.close(); throw error; }
}

export async function placeBoundedLimit(config: SignerConfig, market: LiveMarket, outcome: "YES" | "NO", limitPrice: string, quantity: string): Promise<PlacedOrder> {
  const { sdk, onchain } = await assertTradableMarket(config.privateKey, market);
  try {
    const one = 10n ** BigInt(onchain.decimals);
    const requestedPrice = decimalToUnits(limitPrice, onchain.decimals);
    const requestedQuantity = decimalToUnits(quantity, onchain.decimals);
    const params = await sdk.client.getBinaryBookParams(onchain.pool);
    const price = snapDown(requestedPrice, params.tickSize);
    const alignedQuantity = snapDown(requestedQuantity, params.lotSize);
    const maxCollateral = decimalToUnits(config.maxCollateral, onchain.decimals);
    const maxQuantity = decimalToUnits(config.maxQuantity, onchain.decimals);
    assertBoundedIntent(price, alignedQuantity, one, maxCollateral, maxQuantity);
    const trader = sdk.client.createTrader({ privateKey: config.privateKey, decimals: onchain.decimals });
    const result = await trader.placeOrder({ pool: onchain.pool, side: outcome === "YES" ? "BUY_YES" : "BUY_NO", price, quantity: alignedQuantity, outcomeToken: onchain.outcomeToken, yesId: onchain.yesId, noId: onchain.noId, collateral: onchain.collateral, expireTimestampNs: onchain.expiry * 1_000_000_000n, autoApprove: true });
    if (result.receipt.status !== "success") throw new Error("Order transaction was mined without success.");
    const filled = result.fills.reduce((total, fill) => total + (fill.takerOrderId === result.orderId ? fill.quantityFilled : 0n), 0n);
    const remaining = result.orderId ? (await sdk.client.getOrderOnchain(onchain.pool, result.orderId))?.quantityRemaining ?? 0n : alignedQuantity - filled;
    return { hash: result.hash, orderId: result.orderId?.toString() ?? null, price: price.toString(), quantity: alignedQuantity.toString(), filled: (alignedQuantity - remaining).toString(), remaining: remaining.toString(), pool: onchain.pool, nonce: onchain.nonce.toString() };
  } finally { sdk.close(); }
}

export async function reconcileOrder(privateKey: `0x${string}`, pool: string, orderId: string) {
  const sdk = exchange(privateKey);
  try { return await sdk.client.getOrderOnchain(pool as Address, BigInt(orderId)); }
  finally { sdk.close(); }
}

export function signerAddress(privateKey: `0x${string}`) { return privateKeyToAccount(privateKey).address; }
