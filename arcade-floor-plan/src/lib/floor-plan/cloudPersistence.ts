import { getSupabaseClient } from "../supabase/client";
import type { FloorPlan, Venue } from "../../types/floorPlan";
import type { LayoutMachine } from "../../types/layout";
import type { Machine, TransferBuffer, TransferBufferItem, VenueMachine } from "../../types/machine";

const required = () => { const client = getSupabaseClient(); if (!client) throw new Error("Supabase is not configured."); return client; };
const iso = (value: string) => value || new Date().toISOString();

export async function loadCloudGlobal() {
  const client = getSupabaseClient(); if (!client) return null;
  const [venues, catalog, units, buffers, items] = await Promise.all([
    client.from("venues").select("id,name"), client.from("catalog_machines").select("*"), client.from("venue_machines").select("*"), client.from("transfer_buffers").select("*"), client.from("transfer_buffer_items").select("*")
  ]);
  const error = [venues, catalog, units, buffers, items].find((result) => result.error)?.error; if (error) throw error;
  // The bootstrap migration creates one empty Global staging buffer. Treat that
  // row as an empty cloud workspace so it cannot overwrite a populated local
  // IndexedDB workspace during first-load migration.
  const meaningfulBuffers = (buffers.data ?? []).filter((buffer) => buffer.name !== "Global staging" || (items.data ?? []).some((item) => item.transfer_buffer_id === buffer.id));
  if (!venues.data?.length && !catalog.data?.length && !units.data?.length && !meaningfulBuffers.length && !items.data?.length) return null;
  return {
    projects: (venues.data ?? []) as Venue[],
    machines: (catalog.data ?? []).map((m) => ({ id: m.id, name: m.name, category: m.category, imageUrl: m.image_url, widthMm: Number(m.width_mm), depthMm: Number(m.depth_mm), heightMm: m.height_mm == null ? undefined : Number(m.height_mm), model: m.model ?? undefined, notes: m.notes ?? undefined, footprintColor: m.footprint_color ?? undefined, footprintTextColor: m.footprint_text_color ?? undefined, createdAt: iso(m.created_at), updatedAt: iso(m.updated_at) })) as Machine[],
    venueMachines: (units.data ?? []).map((m) => ({ id: m.id, venueId: m.venue_id, machineId: m.machine_id, machineCode: m.machine_code, useCustomDimensions: m.use_custom_dimensions, customWidthMm: m.custom_width_mm == null ? null : Number(m.custom_width_mm), customDepthMm: m.custom_depth_mm == null ? null : Number(m.custom_depth_mm), status: m.status, transferredAt: m.transferred_at, createdAt: iso(m.created_at), updatedAt: iso(m.updated_at) })) as VenueMachine[],
    buffers: (buffers.data ?? []).map((b) => ({ id: b.id, name: b.name, destinationVenueId: b.destination_venue_id, createdAt: iso(b.created_at), updatedAt: iso(b.updated_at) })) as TransferBuffer[],
    items: (items.data ?? []).map((i) => ({ id: i.id, transferBufferId: i.transfer_buffer_id, venueMachineId: i.venue_machine_id, sourceVenueId: i.source_venue_id, addedAt: iso(i.added_at), order: i.item_order })) as TransferBufferItem[]
  };
}

export async function persistCloudGlobal(value: { machines: Machine[]; venueMachines: VenueMachine[]; buffers: TransferBuffer[]; items: TransferBufferItem[]; projects?: Venue[] }) {
  const client = required();
  const machinesWithCloudImages = await Promise.all(value.machines.map(async (machine) => {
    if (!machine.imageUrl?.startsWith("data:")) return machine;
    const response = await fetch(machine.imageUrl); const blob = await response.blob(); const path = `catalog/${machine.id}.${blob.type.split("/")[1] || "png"}`;
    const upload = await client.storage.from("machine-images").upload(path, blob, { upsert: true, contentType: blob.type }); if (upload.error) throw upload.error;
    return { ...machine, imageUrl: client.storage.from("machine-images").getPublicUrl(path).data.publicUrl };
  }));
  const writes = [
    ["venues", () => client.from("venues").upsert((value.projects ?? []).map((v) => ({ id: v.id, name: v.name })))],
    ["catalog_machines", () => client.from("catalog_machines").upsert(machinesWithCloudImages.map((m) => ({ id: m.id, name: m.name, category: m.category, image_url: m.imageUrl, width_mm: m.widthMm, depth_mm: m.depthMm, height_mm: m.heightMm ?? null, model: m.model ?? null, notes: m.notes ?? null, footprint_color: m.footprintColor ?? null, footprint_text_color: m.footprintTextColor ?? null, created_at: m.createdAt, updated_at: m.updatedAt })))],
    ["venue_machines", () => client.from("venue_machines").upsert(value.venueMachines.map((m) => ({ id: m.id, venue_id: m.venueId, machine_id: m.machineId, machine_code: m.machineCode, use_custom_dimensions: m.useCustomDimensions, custom_width_mm: m.customWidthMm, custom_depth_mm: m.customDepthMm, status: m.status, transferred_at: m.transferredAt, created_at: m.createdAt, updated_at: m.updatedAt })))],
    ["transfer_buffers", () => client.from("transfer_buffers").upsert(value.buffers.map((b) => ({ id: b.id, name: b.name, destination_venue_id: b.destinationVenueId ?? null, created_at: b.createdAt, updated_at: b.updatedAt })))],
    ["transfer_buffer_items", () => client.from("transfer_buffer_items").upsert(value.items.map((i) => ({ id: i.id, transfer_buffer_id: i.transferBufferId, venue_machine_id: i.venueMachineId, source_venue_id: i.sourceVenueId, added_at: i.addedAt, item_order: i.order })))]
  ] as const;
  for (const [table, write] of writes) {
    const result = await write();
    if (result.error) {
      console.error("[cloud-persistence] write failed", { operation: "upsert", table, code: result.error.code, message: result.error.message, details: result.error.details, hint: result.error.hint });
      throw result.error;
    }
  }
}

export async function loadCloudFloorPlan(venueId: string) {
  const client = getSupabaseClient(); if (!client) return null;
  const { data, error } = await client.from("floor_plans").select("*").eq("venue_id", venueId).maybeSingle(); if (error) throw error; if (!data) return null;
  return { id: data.id, venueId: data.venue_id, imageUrl: data.image_url, imageDataUrl: null, imageWidthPx: data.image_width_px, imageHeightPx: data.image_height_px, scaleMmPerPx: data.scale_mm_per_px == null ? null : Number(data.scale_mm_per_px), backgroundOffsetX: data.background_offset_x == null ? undefined : Number(data.background_offset_x), backgroundOffsetY: data.background_offset_y == null ? undefined : Number(data.background_offset_y), createdAt: iso(data.created_at), updatedAt: iso(data.updated_at) } as FloorPlan;
}

export async function loadCloudLayoutMachines(venueId: string) {
  const client = getSupabaseClient(); if (!client) return null;
  const layoutResult = await client.from("layouts").select("id").eq("venue_id", venueId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (layoutResult.error) throw layoutResult.error;
  if (!layoutResult.data) return null;
  const result = await client.from("layout_machines").select("id,layout_id,venue_machine_id,x_mm,y_mm,rotation").eq("layout_id", layoutResult.data.id);
  if (result.error) throw result.error;
  return (result.data ?? []).map((row) => ({ id: row.id, layoutId: row.layout_id, venueMachineId: row.venue_machine_id, xMm: Number(row.x_mm), yMm: Number(row.y_mm), rotation: Number(row.rotation ?? 0) })) as LayoutMachine[];
}

export async function persistCloudFloorPlan(floorPlan: FloorPlan) {
  const client = required();
  let imageUrl = floorPlan.imageUrl;
  if (floorPlan.imageDataUrl?.startsWith("data:")) {
    const response = await fetch(floorPlan.imageDataUrl); const blob = await response.blob(); const path = `${floorPlan.venueId}/${floorPlan.id}.${blob.type.split("/")[1] || "png"}`;
    const upload = await client.storage.from("floor-plans").upload(path, blob, { upsert: true, contentType: blob.type }); if (upload.error) throw upload.error;
    imageUrl = client.storage.from("floor-plans").getPublicUrl(path).data.publicUrl;
  }
  const { error } = await client.from("floor_plans").upsert({ id: floorPlan.id, venue_id: floorPlan.venueId, image_url: imageUrl, image_width_px: floorPlan.imageWidthPx, image_height_px: floorPlan.imageHeightPx, scale_mm_per_px: floorPlan.scaleMmPerPx, background_offset_x: floorPlan.backgroundOffsetX ?? null, background_offset_y: floorPlan.backgroundOffsetY ?? null, created_at: floorPlan.createdAt, updated_at: floorPlan.updatedAt }); if (error) throw error;
}

export async function persistCloudLayoutMachines(venueId: string, value: LayoutMachine[]) {
  const client = required();
  if (value.length) {
    const layoutId = value[0].layoutId;
    const now = new Date().toISOString();
    const layoutWrite = await client.from("layouts").upsert({ id: layoutId, venue_id: venueId, floor_plan_id: `floor_plan_${venueId}`, name: "Current Layout", created_at: now, updated_at: now }); if (layoutWrite.error) throw layoutWrite.error;
    const existingResult = await client.from("layout_machines").select("id,venue_machine_id").eq("layout_id", layoutId);
    if (existingResult.error) throw existingResult.error;
    const existingIds = new Map((existingResult.data ?? []).map((row) => [row.venue_machine_id, row.id]));
    const { error } = await client.from("layout_machines").upsert(value.map((m) => ({ id: existingIds.get(m.venueMachineId) ?? m.id, layout_id: m.layoutId, venue_machine_id: m.venueMachineId, x_mm: m.xMm, y_mm: m.yMm, rotation: m.rotation })), { onConflict: "venue_machine_id" }); if (error) throw error;
  }
  const { data: layouts } = await client.from("layouts").select("id").eq("venue_id", venueId); const ids = new Set(value.map((m) => m.id));
  if (layouts?.length) { const { data: existing } = await client.from("layout_machines").select("id").eq("layout_id", layouts[0].id); const stale = (existing ?? []).filter((m) => !ids.has(m.id)).map((m) => m.id); if (stale.length) await client.from("layout_machines").delete().in("id", stale); }
}
