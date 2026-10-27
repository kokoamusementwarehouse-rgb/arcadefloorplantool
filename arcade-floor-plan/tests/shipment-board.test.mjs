import test from "node:test";
import assert from "node:assert/strict";
import { getShipmentBoardStage, groupShipmentUnitsByStage } from "../src/lib/shipment-board.ts";

test("unassigned machines remain in the shipping queue before arrival", () => {
  assert.equal(getShipmentBoardStage("ORDERED", { venueId: null }), "in_shipping");
  assert.equal(getShipmentBoardStage("IN_PRODUCTION", { venueId: null }), "in_shipping");
  assert.equal(getShipmentBoardStage("IN_SHIPMENT", { venueId: null }), "in_shipping");
});

test("arrived and closed unassigned machines wait in the Arrived queue", () => {
  assert.equal(getShipmentBoardStage("ARRIVED", { venueId: null }), "arrived");
  assert.equal(getShipmentBoardStage("CLOSED", { venueId: null }), "arrived");
});

test("venue assignment archives a machine as Located regardless of shipment status", () => {
  assert.equal(getShipmentBoardStage("IN_SHIPMENT", { venueId: "warehouse-1" }), "located");
  assert.equal(getShipmentBoardStage("ARRIVED", { venueId: "store-1" }), "located");
  assert.equal(getShipmentBoardStage("CLOSED", { venueId: "store-1" }), "located");
});

test("a partially allocated shipment splits units between Arrived and Located", () => {
  const groups = groupShipmentUnitsByStage("ARRIVED", [
    { id: "waiting", venueId: null },
    { id: "warehouse", venueId: "warehouse-1" },
    { id: "store", venueId: "store-1" },
  ]);
  assert.deepEqual(groups.in_shipping, []);
  assert.deepEqual(groups.arrived.map((unit) => unit.id), ["waiting"]);
  assert.deepEqual(groups.located.map((unit) => unit.id), ["warehouse", "store"]);
});
