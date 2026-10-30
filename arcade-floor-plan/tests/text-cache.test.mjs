import test from "node:test";
import assert from "node:assert/strict";
import { machineTextCacheRatio, shouldCacheMachineText } from "../src/lib/floor-plan/textCache.ts";

test("machine text cache respects display density and uses vector text at high zoom", () => {
  assert.equal(machineTextCacheRatio(0.5, 2), 2);
  assert.equal(machineTextCacheRatio(1, 2), 2);
  assert.equal(machineTextCacheRatio(1.01, 2), 0);
  assert.equal(machineTextCacheRatio(0.5, 4), 0);
  assert.equal(machineTextCacheRatio(NaN, 2), 0);
});

test("machine text cache rejects invalid and oversized allocations", () => {
  assert.equal(shouldCacheMachineText(53, 53, 2), true);
  assert.equal(shouldCacheMachineText(200, 200, 2), false);
  assert.equal(shouldCacheMachineText(300, 10, 2), false);
  assert.equal(shouldCacheMachineText(0, 10, 2), false);
  assert.equal(shouldCacheMachineText(10, 10, 0), false);
});
