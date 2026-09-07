import type { Machine, VenueMachine } from "../types/machine";

const timestamp = "2026-09-04T00:00:00.000Z";
const placeholder = "/machines/mini-claw-placeholder.png";

const standardMachines: Machine[] = [
  ["mini-claw", "Mini Claw", "Claw", 820, 760], ["double-claw", "Double Claw", "Claw", 1620, 760],
  ["racing", "Mario Racing", "Arcade", 980, 1650], ["shooting", "Shooting Machine", "Arcade", 1000, 1200],
  ["basketball", "Basketball Machine", "Arcade", 1100, 2500], ["pool", "Pool Table", "Pool", 2830, 1530],
  ["kids-ride", "Kids Ride", "Other", 1200, 800],
].map(([id, name, category, widthMm, depthMm]) => ({
  id: `machine_${id}`, name: String(name), category: category as Machine["category"], imageUrl: placeholder,
  widthMm: Number(widthMm), depthMm: Number(depthMm), createdAt: timestamp, updatedAt: timestamp,
}));

const bundledTestMachines: Machine[] = standardMachines.concat({
  id: "machine_play_a_ball", name: "Play a Ball", category: "Arcade", imageUrl: "/machines/play-a-ball.png",
  widthMm: 1840, depthMm: 1280, heightMm: 2100, createdAt: timestamp, updatedAt: timestamp,
});

const operationalVenueMachines: VenueMachine[] = [
  ["C01", "mini-claw"], ["C02", "mini-claw"], ["C03", "double-claw"], ["R01", "racing"], ["R02", "racing"],
  ["S01", "shooting"], ["B01", "basketball"], ["P01", "pool"], ["K01", "kids-ride"],
  ["PAB01", "play_a_ball", "venue_rhodes_warehouse"],
  ["PAB-T01", "play_a_ball", "venue_koko_rhodes"],
].map(([machineCode, machineId, venueId]) => ({
  id: `venue_machine_${machineCode}`, venueId: String(venueId ?? "venue_koko_rhodes"), machineId: `machine_${machineId}`,
  machineCode: String(machineCode), useCustomDimensions: false, customWidthMm: null, customDepthMm: null, status: "active" as const, createdAt: timestamp, updatedAt: timestamp,
}));

const qaModels = ["mini-claw", "double-claw", "racing", "shooting", "basketball", "kids-ride", "play_a_ball"];
const qaVenueMachines: VenueMachine[] = Array.from({ length: 50 }, (_, index) => ({
  id: `venue_machine_QA${String(index + 1).padStart(2, "0")}`,
  venueId: "venue_qa_dense",
  machineId: `machine_${qaModels[index % qaModels.length]}`,
  machineCode: `QA${String(index + 1).padStart(2, "0")}`,
  useCustomDimensions: false,
  customWidthMm: null,
  customDepthMm: null,
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
}));

const bundledTestVenueMachines: VenueMachine[] = operationalVenueMachines.concat(qaVenueMachines);

// The product starts with an empty workspace. These fixtures remain named here only
// as a migration reference for older local workspaces; they are not seeded into the app.
export const machines: Machine[] = [];
export const venueMachines: VenueMachine[] = [];
