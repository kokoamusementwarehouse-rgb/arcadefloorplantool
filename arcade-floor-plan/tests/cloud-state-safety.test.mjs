import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("cloud persistence contains reads only, never a generic business snapshot write", async () => {
  const [cloudPersistence, persistence] = await Promise.all([
    source("../src/lib/floor-plan/cloudPersistence.ts"),
    source("../src/lib/floor-plan/persistence.ts"),
  ]);

  for (const forbidden of ["persistCloudGlobal", "persistCloudFloorPlan", "persistCloudLayoutMachines", "reconcileRows"]) {
    assert.equal(cloudPersistence.includes(forbidden), false, `${forbidden} must not return`);
  }
  assert.equal(persistence.includes("getSupabaseClient"), false, "IndexedDB cache code must not own a Supabase client");
  // `IDBObjectStore.delete()` is permitted for cache cleanup; the cache module
  // must only be forbidden from using Supabase/HTTP write APIs.
  for (const forbidden of [".insert(", ".update(", ".upsert(", ".from(", "fetch("]) {
    assert.equal(persistence.includes(forbidden), false, `cache module must not contain cloud ${forbidden}`);
  }
});

test("only the explicit USER_MUTATION command module owns Floor Plan cloud writes", async () => {
  const commands = await source("../src/lib/floor-plan/cloudMutations.ts");
  assert.match(commands, /canMutateCloud\s*=\s*\(origin[^=]*=>\s*origin\s*===\s*"USER_MUTATION"/);
  assert.match(commands, /assertCloudMutationOrigin\(origin\)/);
  assert.match(commands, /Cloud mutation rejected/);
  assert.match(commands, /Field-level layout update/);
  assert.match(commands, /never inspects or deletes sibling placements/);
});

test("active venue restoration is navigation-only and cannot enqueue a cloud mutation", async () => {
  const store = await source("../src/store/floorPlanStore.ts");
  const start = store.indexOf("setVenue: (venue) =>");
  // `addVenue` accepts an optional venue type now; this boundary must not
  // depend on its parameter list, only on the next state command.
  const end = store.indexOf("addVenue: (", start);
  assert.ok(start >= 0 && end > start, "setVenue block must be present");
  const navigation = store.slice(start, end);
  assert.doesNotMatch(navigation, /enqueueUserMutation|InCloud|\.from\(/);
  assert.match(navigation, /localStorage\.setItem\("floorplan-active-venue"/);
  assert.match(navigation, /createEmptyFloorPlan/);
  assert.match(navigation, /createEmptyLayout/);
});

test("Floor Plan and workspace hydration only read cloud and refresh cache", async () => {
  const [library, canvas] = await Promise.all([
    source("../src/components/floor-plan/MachineLibrary.tsx"),
    source("../src/components/floor-plan/FloorPlanCanvas.tsx"),
  ]);

  for (const forbidden of ["persistGlobalState", "remoteGlobalApply", "deleteVenuePersistence"]) {
    assert.equal(library.includes(forbidden), false, `workspace hydration must not use ${forbidden}`);
  }
  assert.match(library, /hydrateGlobal\(loaded\.value, loaded\.source === "cloud" \? "CLOUD_HYDRATION" : "CACHE_RESTORE"\)/);
  assert.match(library, /if \(!loaded \|\| loaded\.source !== "cloud"\) return/);

  for (const forbidden of ["persistFloorPlan", "persistLayoutMachines", "persistCloudFloorPlan", "remoteLayoutApply"]) {
    assert.equal(canvas.includes(forbidden), false, `route hydration must not use ${forbidden}`);
  }
  assert.match(canvas, /loadPersistedFloorPlan\(venue\.id\)/);
  assert.match(canvas, /loadPersistedLayoutMachines\(venue\.id\)/);
  assert.match(canvas, /setFloorPlan\(plan, "REALTIME_REMOTE"\)/);
  assert.match(canvas, /setLayoutMachines\(layoutState\.machines, "REALTIME_REMOTE"\)/);
});

test("Machines page is cloud-read-only on mount and shipment creation uses locked server commands", async () => {
  const [machineRegistry, machineAssets, floorPlanStore, cloudMutations, migration] = await Promise.all([
    source("../src/components/machines/MachineRegistry.tsx"),
    source("../src/lib/machine-assets.ts"),
    source("../src/store/floorPlanStore.ts"),
    source("../src/lib/floor-plan/cloudMutations.ts"),
    source("../supabase/migrations/008_transactional_shipment_creation.sql"),
  ]);
  assert.doesNotMatch(machineRegistry, /indexedDB|localStorage|sessionStorage/);
  assert.match(machineRegistry, /loadMachineAssetWorkspace\(\)/);
  assert.match(machineRegistry, /client\.channel\("machine-assets-realtime"\)/);
  for (const table of ["venues", "catalog_machines", "venue_machines", "shipments", "shipment_items"]) {
    assert.match(machineRegistry, new RegExp(`table: "${table}"`));
  }
  assert.match(machineAssets, /rpc\("create_shipment_with_machines"/);
  assert.match(machineRegistry, /SHIPMENT_STATUSES/);
  assert.match(machineRegistry, /<option key=\{item\} value=\{item\}>\{shipmentStatusLabel\(item\)\}<\/option>/);
  assert.match(migration, /p_status not in \('ORDERED', 'IN_PRODUCTION', 'IN_SHIPMENT', 'ARRIVED', 'CLOSED'\)/);
  assert.match(machineAssets, /rpc\("copy_venue_machine_with_next_code"/);
  assert.match(cloudMutations, /rpc\("create_venue_machine_with_code"/);
  assert.doesNotMatch(machineAssets, /from\("shipments"\)\.insert/);
  assert.doesNotMatch(machineAssets, /from\("venue_machines"\)\.insert/);
  assert.doesNotMatch(floorPlanStore, /nextAvailableVenueMachineCode/);
  assert.match(machineAssets, /remove\(uploadedPaths\)/);
  assert.match(migration, /pg_advisory_xact_lock\(80421655\)/);
  assert.match(migration, /venue_id, machine_id, machine_code/);
  assert.match(migration, /null, catalog_id, code/);
  assert.match(migration, /create_venue_machine_with_code/);
  assert.match(migration, /pilot_machine_images_delete/);
});
