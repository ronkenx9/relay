import assert from "node:assert/strict";
import test from "node:test";
import { RelaySafetyError, assertBoundedIntent, decimalToUnits, selectDirectSuccessor, snapDown, unitsToDecimal } from "../lib/relay-core";

const source = { operatorId: 7, venueId: "0xvenue", asset: "BTC", intervalSec: 900, marketId: "0xold", expiry: 100 };

test("selects the immediate matching successor without consulting a pool", () => {
  const next = selectDirectSuccessor(source, [
    { ...source, marketId: "0xwrong-series", asset: "ETH", expiry: 101 },
    { ...source, marketId: "0xlater", expiry: 300 },
    { ...source, marketId: "0xnext", expiry: 200 },
  ]);
  assert.equal(next.marketId, "0xnext");
});

test("rejects an ambiguous or non-forward successor", () => {
  assert.throws(() => selectDirectSuccessor(source, [{ ...source, marketId: "0xa", expiry: 200 }, { ...source, marketId: "0xb", expiry: 200 }]), RelaySafetyError);
  assert.throws(() => selectDirectSuccessor(source, [{ ...source, marketId: "0xold", expiry: 100 }]), RelaySafetyError);
});

test("decimal math is exact, grid-aligned, and cap-bounded", () => {
  assert.equal(decimalToUnits("0.55", 6), 550000n);
  assert.equal(unitsToDecimal(1234500n, 6), "1.2345");
  assert.equal(snapDown(557000n, 10000n), 550000n);
  assertBoundedIntent(550000n, 1000000n, 1000000n, 1000000n, 2000000n);
  assert.throws(() => assertBoundedIntent(550000n, 3000000n, 1000000n, 1000000n, 2000000n), RelaySafetyError);
});
