export type SeriesKey = { operatorId: number; venueId: string; asset: string; intervalSec: number };
export type RelayState = "ARMED" | "PLACING" | "ACTIVE" | "ROLLING" | "COMPLETED" | "PAUSED" | "FAILED";

export type CandidateMarket = SeriesKey & { marketId: string; expiry: number };

export class RelaySafetyError extends Error {}

export function sameSeries(a: SeriesKey, b: SeriesKey) {
  return a.operatorId === b.operatorId && a.venueId.toLowerCase() === b.venueId.toLowerCase() && a.asset === b.asset && a.intervalSec === b.intervalSec;
}

/** Picks exactly one later market. A pool address is intentionally not an input. */
export function selectDirectSuccessor(source: CandidateMarket, candidates: CandidateMarket[]) {
  const later = candidates.filter((candidate) => sameSeries(source, candidate) && candidate.expiry > source.expiry).sort((a, b) => a.expiry - b.expiry);
  if (!later.length) throw new RelaySafetyError("No later market in the same verified series.");
  if (later.length > 1 && later[0].expiry === later[1].expiry) throw new RelaySafetyError("Ambiguous successor: multiple matching markets share the next expiry.");
  return later[0];
}

export function decimalToUnits(input: string, decimals: number) {
  if (!/^\d+(?:\.\d+)?$/.test(input)) throw new RelaySafetyError("Expected a positive decimal string.");
  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > decimals) throw new RelaySafetyError(`Value has more than ${decimals} decimal places.`);
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals));
  if (units <= 0n) throw new RelaySafetyError("Value must be positive.");
  return units;
}

export function unitsToDecimal(value: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals); const whole = value / base; const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function snapDown(value: bigint, step: bigint) {
  if (step <= 0n) throw new RelaySafetyError("Invalid market grid.");
  const snapped = value - (value % step);
  if (snapped <= 0n) throw new RelaySafetyError("Value rounds below the market grid.");
  return snapped;
}

export function assertBoundedIntent(price: bigint, quantity: bigint, one: bigint, maxCollateral: bigint, maxQuantity: bigint) {
  if (price <= 0n || price >= one) throw new RelaySafetyError("Limit price must be strictly between 0 and 1.");
  if (quantity > maxQuantity) throw new RelaySafetyError("Quantity exceeds RELAY_MAX_QUANTITY.");
  const ceilingCost = (price * quantity + one - 1n) / one;
  if (ceilingCost > maxCollateral) throw new RelaySafetyError("Collateral ceiling exceeds RELAY_MAX_COLLATERAL.");
}
