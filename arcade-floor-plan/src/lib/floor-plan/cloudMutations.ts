import { getSupabaseClient } from "../supabase/client";
import type { FloorPlan, Venue } from "../../types/floorPlan";
import type { Layout, LayoutMachine } from "../../types/layout";
import type { Machine, TransferBuffer, TransferBufferItem, VenueMachine } from "../../types/machine";

/**
 * Cloud writes are deliberately kept out of hydration and cache code.
 * Every export in this module represents a concrete user command; there is
 * no workspace- or layout-snapshot synchronisation API.
 */
export type BusinessStateOrigin = "USER_MUTATION" | "CLOUD_HYDRATION" | "REALTIME_REMOTE" | "CACHE_RESTORE";

/** A small, testable guard that makes write authority explicit. */
export const canMutateCloud = (origin: BusinessStateOrigin) => origin === "USER_MUTATION";

export function assertCloudMutationOrigin(origin: BusinessStateOrigin) {
  if (!canMutateCloud(origin)) throw new Error(`Cloud mutation rejected for ${origin}.`);
}

const clientOrThrow = (origin: BusinessStateOrigin = "USER_MUTATION") => {
  assertCloudMutationOrigin(origin);
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
};

const timestamp = () => new Date().toISOString();

const uploadDataUrl = async (bucket: "machine-images" | "floor-plans", path: string, dataUrl: string) => {
  const client = clientOrThrow();
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const upload = await client.storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type });
  if (upload.error) throw upload.error;
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};

const catalogRow = (machine: Machine, imageUrl: string | null) => ({
  id: machine.id,
  name: machine.name,
  category: machine.category,
  image_url: imageUrl,
  width_mm: machine.widthMm,
  depth_mm: machine.depthMm,
  height_mm: machine.heightMm ?? null,
  model: machine.model ?? null,
  notes: machine.notes ?? null,
  footprint_color: machine.footprintColor ?? null,
  footprint_text_color: machine.footprintTextColor ?? null,
  created_at: machine.createdAt,
  updated_at: machine.updatedAt,
});

const venueMachineRow = (machine: VenueMachine) => ({
  id: machine.id,
  venue_id: machine.venueId,
  machine_id: machine.machineId,
  machine_code: machine.machineCode,
  use_custom_dimensions: machine.useCustomDimensions,
  custom_width_mm: machine.customWidthMm,
  custom_depth_mm: machine.customDepthMm,
  status: machine.status,
  transferred_at: machine.transferredAt ?? null,
  condition: machine.condition,
  for_sale: machine.forSale,
  maintenance_status: machine.maintenanceStatus,
  maintenance_note: machine.maintenanceNote ?? null,
  missing_parts: machine.missingParts ?? [],
  received_at: machine.receivedAt ?? null,
  created_at: machine.createdAt,
  updated_at: machine.updatedAt,
});

export async function createVenue(venue: Venue) {
  const { error } = await clientOrThrow().from("venues").insert({ id: venue.id, name: venue.name });
  if (error) throw error;
}

export async function renameVenue(id: string, name: string) {
  const { error } = await clientOrThrow().from("venues").update({ name, updated_at: timestamp() }).eq("id", id);
  if (error) throw error;
}

/** Explicit destructive command. Database foreign keys remove venue-owned records. */
export async function deleteVenue(id: string, unusedCatalogMachineIds: string[] = []) {
  const client = clientOrThrow();
  const venueDelete = await client.from("venues").delete().eq("id", id);
  if (venueDelete.error) throw venueDelete.error;
  if (unusedCatalogMachineIds.length) {
    const catalogDelete = await client.from("catalog_machines").delete().in("id", unusedCatalogMachineIds);
    if (catalogDelete.error) throw catalogDelete.error;
  }
}

export async function createCatalogMachine(machine: Machine) {
  let imageUrl = machine.imageUrl;
  if (imageUrl?.startsWith("data:")) {
    const mime = imageUrl.match(/^data:([^;,]+)/)?.[1] ?? "image/png";
    imageUrl = await uploadDataUrl("machine-images", `catalog/${machine.id}.${mime.split("/")[1] || "png"}`, imageUrl);
  }
  const { error } = await clientOrThrow().from("catalog_machines").insert(catalogRow(machine, imageUrl));
  if (error) throw error;
  return imageUrl;
}

export type CatalogMachinePatch = Partial<Pick<Machine, "name" | "category" | "imageUrl" | "widthMm" | "depthMm" | "heightMm" | "model" | "notes" | "footprintColor" | "footprintTextColor">>;

/** Field-level catalog update. Unspecified fields are never included in the request. */
export async function patchCatalogMachine(id: string, patch: CatalogMachinePatch) {
  const row: Record<string, unknown> = { updated_at: timestamp() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.widthMm !== undefined) row.width_mm = patch.widthMm;
  if (patch.depthMm !== undefined) row.depth_mm = patch.depthMm;
  if (patch.heightMm !== undefined) row.height_mm = patch.heightMm ?? null;
  if (patch.model !== undefined) row.model = patch.model ?? null;
  if (patch.notes !== undefined) row.notes = patch.notes ?? null;
  if (patch.footprintColor !== undefined) row.footprint_color = patch.footprintColor ?? null;
  if (patch.footprintTextColor !== undefined) row.footprint_text_color = patch.footprintTextColor ?? null;
  if (patch.imageUrl !== undefined) {
    if (patch.imageUrl?.startsWith("data:")) {
      const mime = patch.imageUrl.match(/^data:([^;,]+)/)?.[1] ?? "image/png";
      row.image_url = await uploadDataUrl("machine-images", `catalog/${id}.${mime.split("/")[1] || "png"}`, patch.imageUrl);
    } else row.image_url = patch.imageUrl;
  }
  const { error } = await clientOrThrow().from("catalog_machines").update(row).eq("id", id);
  if (error) throw error;
  return typeof row.image_url === "string" ? row.image_url : patch.imageUrl;
}

export async function createVenueMachine(machine: VenueMachine) {
  const { error } = await clientOrThrow().from("venue_machines").insert(venueMachineRow(machine));
  if (error) throw error;
}

export type VenueMachinePatch = Partial<Pick<VenueMachine, "venueId" | "machineCode" | "useCustomDimensions" | "customWidthMm" | "customDepthMm" | "status" | "transferredAt" | "condition" | "forSale" | "maintenanceStatus" | "maintenanceNote" | "missingParts" | "receivedAt">>;

/** Field-level physical-machine update. This intentionally cannot alter model identity. */
export async function patchVenueMachine(id: string, patch: VenueMachinePatch) {
  const row: Record<string, unknown> = { updated_at: timestamp() };
  if (patch.venueId !== undefined) row.venue_id = patch.venueId;
  if (patch.machineCode !== undefined) row.machine_code = patch.machineCode;
  if (patch.useCustomDimensions !== undefined) row.use_custom_dimensions = patch.useCustomDimensions;
  if (patch.customWidthMm !== undefined) row.custom_width_mm = patch.customWidthMm;
  if (patch.customDepthMm !== undefined) row.custom_depth_mm = patch.customDepthMm;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.transferredAt !== undefined) row.transferred_at = patch.transferredAt;
  if (patch.condition !== undefined) row.condition = patch.condition;
  if (patch.forSale !== undefined) row.for_sale = patch.forSale;
  if (patch.maintenanceStatus !== undefined) row.maintenance_status = patch.maintenanceStatus;
  if (patch.maintenanceNote !== undefined) row.maintenance_note = patch.maintenanceNote;
  if (patch.missingParts !== undefined) row.missing_parts = patch.missingParts;
  if (patch.receivedAt !== undefined) row.received_at = patch.receivedAt;
  const { error } = await clientOrThrow().from("venue_machines").update(row).eq("id", id);
  if (error) throw error;
}

/** Explicit destructive command. Foreign keys remove placements/buffer membership. */
export async function deleteVenueMachines(ids: string[]) {
  if (!ids.length) return;
  const { error } = await clientOrThrow().from("venue_machines").delete().in("id", ids);
  if (error) throw error;
}

export async function createTransferBuffer(buffer: TransferBuffer) {
  const { error } = await clientOrThrow().from("transfer_buffers").insert({ id: buffer.id, name: buffer.name, destination_venue_id: buffer.destinationVenueId ?? null, created_at: buffer.createdAt, updated_at: buffer.updatedAt });
  if (error) throw error;
}

export async function renameTransferBuffer(id: string, name: string) {
  const { error } = await clientOrThrow().from("transfer_buffers").update({ name, updated_at: timestamp() }).eq("id", id);
  if (error) throw error;
}

/** Explicit destructive command; UI only permits this for an empty buffer. */
export async function deleteTransferBuffer(id: string) {
  const { error } = await clientOrThrow().from("transfer_buffers").delete().eq("id", id);
  if (error) throw error;
}

export async function moveVenueMachinesToBuffer(input: { venueMachineIds: string[]; bufferItems: TransferBufferItem[] }) {
  const ids = input.venueMachineIds;
  if (!ids.length) return;
  const client = clientOrThrow();
  const updated = await client.from("venue_machines").update({ venue_id: null, transferred_at: null, updated_at: timestamp() }).in("id", ids);
  if (updated.error) throw updated.error;
  const placements = await client.from("layout_machines").delete().in("venue_machine_id", ids);
  if (placements.error) throw placements.error;
  if (input.bufferItems.length) {
    const inserted = await client.from("transfer_buffer_items").insert(input.bufferItems.map((item) => ({ id: item.id, transfer_buffer_id: item.transferBufferId, venue_machine_id: item.venueMachineId, source_venue_id: item.sourceVenueId, added_at: item.addedAt, item_order: item.order })));
    if (inserted.error) throw inserted.error;
  }
}

export async function moveBufferItemsToVenue(input: { itemIds: string[]; venueMachineIds: string[]; venueId: string; transferredAt: string }) {
  if (!input.itemIds.length) return;
  const client = clientOrThrow();
  const units = await client.from("venue_machines").update({ venue_id: input.venueId, transferred_at: input.transferredAt, updated_at: timestamp() }).in("id", input.venueMachineIds);
  if (units.error) throw units.error;
  const items = await client.from("transfer_buffer_items").delete().in("id", input.itemIds);
  if (items.error) throw items.error;
}

export async function returnBufferItemsToSource(input: { items: TransferBufferItem[] }) {
  if (!input.items.length) return;
  const client = clientOrThrow();
  for (const item of input.items) {
    const unit = await client.from("venue_machines").update({ venue_id: item.sourceVenueId, updated_at: timestamp() }).eq("id", item.venueMachineId);
    if (unit.error) throw unit.error;
  }
  const deleted = await client.from("transfer_buffer_items").delete().in("id", input.items.map((item) => item.id));
  if (deleted.error) throw deleted.error;
}

const toLayout = (row: { id: string; venue_id: string; floor_plan_id: string | null; name: string; created_at: string; updated_at: string }): Layout => ({
  id: row.id,
  venueId: row.venue_id,
  floorPlanId: row.floor_plan_id ?? `floor_plan_${row.venue_id}`,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Resolve the cloud's current layout before a user explicitly places a
 * machine.  This intentionally does not upsert the local layout ID: a stale
 * cached layout must never create a second cloud layout or overwrite its
 * metadata.  Only when the venue genuinely has no layout do we insert the
 * deterministic empty-layout ID.
 */
const ensureLayout = async (layout: Layout): Promise<Layout> => {
  const client = clientOrThrow();
  const existing = await client.from("layouts").select("*").eq("venue_id", layout.venueId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return toLayout(existing.data);

  const deterministicId = `layout_${layout.venueId}`;
  const inserted = await client.from("layouts").insert({
    id: deterministicId,
    venue_id: layout.venueId,
    floor_plan_id: layout.floorPlanId,
    name: layout.name,
    created_at: layout.createdAt,
    updated_at: timestamp(),
  }).select("*").maybeSingle();
  if (inserted.error) {
    // Another device may have created it after our read. Re-read rather than
    // treating that race as permission to write a stale local layout.
    const raced = await client.from("layouts").select("*").eq("venue_id", layout.venueId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (raced.error || !raced.data) throw inserted.error;
    return toLayout(raced.data);
  }
  if (!inserted.data) throw new Error("Layout creation returned no row.");
  return toLayout(inserted.data);
};

export async function createLayoutMachine(layout: Layout, machine: LayoutMachine) {
  const cloudLayout = await ensureLayout(layout);
  const { error } = await clientOrThrow().from("layout_machines").insert({ id: machine.id, layout_id: cloudLayout.id, venue_machine_id: machine.venueMachineId, x_mm: machine.xMm, y_mm: machine.yMm, rotation: machine.rotation });
  if (error) throw error;
}

export type LayoutMachinePatch = Partial<Pick<LayoutMachine, "xMm" | "yMm" | "rotation">>;

/** Field-level layout update. It never inspects or deletes sibling placements. */
export async function patchLayoutMachine(id: string, patch: LayoutMachinePatch) {
  const row: Record<string, unknown> = {};
  if (patch.xMm !== undefined) row.x_mm = patch.xMm;
  if (patch.yMm !== undefined) row.y_mm = patch.yMm;
  if (patch.rotation !== undefined) row.rotation = patch.rotation;
  if (!Object.keys(row).length) return;
  const { error } = await clientOrThrow().from("layout_machines").update(row).eq("id", id);
  if (error) throw error;
}

/** Explicit placement removal only. */
export async function deleteLayoutMachine(id: string) {
  const { error } = await clientOrThrow().from("layout_machines").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Undo/redo is still an explicit user gesture, but it must be represented as
 * exact row commands.  It deliberately compares two user-history snapshots,
 * never a local cache against the cloud database.
 */
export async function applyLayoutUserDiff(layout: Layout, before: LayoutMachine[], after: LayoutMachine[]) {
  const previous = new Map(before.map((item) => [item.id, item]));
  const next = new Map(after.map((item) => [item.id, item]));
  for (const item of before) if (!next.has(item.id)) await deleteLayoutMachine(item.id);
  for (const item of after) {
    const old = previous.get(item.id);
    if (!old) {
      await createLayoutMachine(layout, item);
      continue;
    }
    const patch: LayoutMachinePatch = {};
    if (old.xMm !== item.xMm) patch.xMm = item.xMm;
    if (old.yMm !== item.yMm) patch.yMm = item.yMm;
    if (old.rotation !== item.rotation) patch.rotation = item.rotation;
    if (Object.keys(patch).length) await patchLayoutMachine(item.id, patch);
  }
}

export async function upsertUserFloorPlan(floorPlan: FloorPlan) {
  let imageUrl = floorPlan.imageUrl;
  if (floorPlan.imageDataUrl?.startsWith("data:")) {
    const mime = floorPlan.imageDataUrl.match(/^data:([^;,]+)/)?.[1] ?? "image/png";
    imageUrl = await uploadDataUrl("floor-plans", `${floorPlan.venueId}/${floorPlan.id}.${mime.split("/")[1] || "png"}`, floorPlan.imageDataUrl);
  }
  const { error } = await clientOrThrow().from("floor_plans").upsert({ id: floorPlan.id, venue_id: floorPlan.venueId, image_url: imageUrl, image_width_px: floorPlan.imageWidthPx, image_height_px: floorPlan.imageHeightPx, scale_mm_per_px: floorPlan.scaleMmPerPx, background_offset_x: floorPlan.backgroundOffsetX ?? null, background_offset_y: floorPlan.backgroundOffsetY ?? null, created_at: floorPlan.createdAt, updated_at: floorPlan.updatedAt });
  if (error) throw error;
  return imageUrl;
}

export type FloorPlanPatch = Partial<Pick<FloorPlan, "scaleMmPerPx" | "backgroundOffsetX" | "backgroundOffsetY">>;

/** Field-level plan update used by calibration and background positioning. */
export async function patchFloorPlan(id: string, patch: FloorPlanPatch) {
  const row: Record<string, unknown> = { updated_at: timestamp() };
  if (patch.scaleMmPerPx !== undefined) row.scale_mm_per_px = patch.scaleMmPerPx;
  if (patch.backgroundOffsetX !== undefined) row.background_offset_x = patch.backgroundOffsetX;
  if (patch.backgroundOffsetY !== undefined) row.background_offset_y = patch.backgroundOffsetY;
  const { error } = await clientOrThrow().from("floor_plans").update(row).eq("id", id);
  if (error) throw error;
}

/** Explicit plan deletion. Layouts and their placements cascade via the schema. */
export async function deleteFloorPlan(venueId: string) {
  const { error } = await clientOrThrow().from("floor_plans").delete().eq("venue_id", venueId);
  if (error) throw error;
}
