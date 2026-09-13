import { getSupabaseClient } from "../supabase/client";
import type { FloorPlan, Venue } from "../../types/floorPlan";
import type { Layout, LayoutMachine } from "../../types/layout";
import type { Machine, TransferBuffer, TransferBufferItem, VenueMachine } from "../../types/machine";

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
  const imageFiles = await client.storage.from("machine-images").list("catalog", { limit: 1000 }).then((result) => result.data ?? []).catch(() => []);
  const imageByMachineId = new Map(imageFiles.filter((file) => file.name).map((file) => [file.name.replace(/\.[^.]+$/, ""), client.storage.from("machine-images").getPublicUrl(`catalog/${file.name}`).data.publicUrl]));
  return {
    projects: (venues.data ?? []) as Venue[],
    machines: (catalog.data ?? []).map((m) => ({ id: m.id, name: m.name, category: m.category, imageUrl: m.image_url ?? imageByMachineId.get(String(m.id)) ?? null, widthMm: Number(m.width_mm), depthMm: Number(m.depth_mm), heightMm: m.height_mm == null ? undefined : Number(m.height_mm), model: m.model ?? undefined, notes: m.notes ?? undefined, footprintColor: m.footprint_color ?? undefined, footprintTextColor: m.footprint_text_color ?? undefined, createdAt: iso(m.created_at), updatedAt: iso(m.updated_at) })) as Machine[],
    venueMachines: (units.data ?? []).map((m) => ({ id: m.id, venueId: m.venue_id, machineId: m.machine_id, machineCode: m.machine_code, useCustomDimensions: m.use_custom_dimensions, customWidthMm: m.custom_width_mm == null ? null : Number(m.custom_width_mm), customDepthMm: m.custom_depth_mm == null ? null : Number(m.custom_depth_mm), status: m.status, transferredAt: m.transferred_at, condition: m.condition === "NEW" ? "NEW" : "USED", forSale: Boolean(m.for_sale), maintenanceStatus: ["OK", "NEEDS_REPAIR", "WAITING_PARTS", "UNDER_REPAIR"].includes(m.maintenance_status) ? m.maintenance_status : "OK", maintenanceNote: m.maintenance_note ?? null, missingParts: Array.isArray(m.missing_parts) ? m.missing_parts : [], receivedAt: m.received_at ?? null, createdAt: iso(m.created_at), updatedAt: iso(m.updated_at) })) as VenueMachine[],
    buffers: (buffers.data ?? []).map((b) => ({ id: b.id, name: b.name, destinationVenueId: b.destination_venue_id, createdAt: iso(b.created_at), updatedAt: iso(b.updated_at) })) as TransferBuffer[],
    items: (items.data ?? []).map((i) => ({ id: i.id, transferBufferId: i.transfer_buffer_id, venueMachineId: i.venue_machine_id, sourceVenueId: i.source_venue_id, addedAt: iso(i.added_at), order: i.item_order })) as TransferBufferItem[]
  };
}

export async function loadCloudFloorPlan(venueId: string) {
  const client = getSupabaseClient(); if (!client) return null;
  const { data, error } = await client.from("floor_plans").select("*").eq("venue_id", venueId).maybeSingle(); if (error) throw error; if (!data) return null;
  return { id: data.id, venueId: data.venue_id, imageUrl: data.image_url, imageDataUrl: null, imageWidthPx: data.image_width_px, imageHeightPx: data.image_height_px, scaleMmPerPx: data.scale_mm_per_px == null ? null : Number(data.scale_mm_per_px), backgroundOffsetX: data.background_offset_x == null ? undefined : Number(data.background_offset_x), backgroundOffsetY: data.background_offset_y == null ? undefined : Number(data.background_offset_y), createdAt: iso(data.created_at), updatedAt: iso(data.updated_at) } as FloorPlan;
}

/**
 * Reads the exact layout record as well as its placements.  The layout id is
 * business data: inventing `layout_${venueId}` after a cloud read can create a
 * second layout and split a venue's placements across two records.
 */
export async function loadCloudLayout(venueId: string): Promise<{ layout: Layout | null; machines: LayoutMachine[] }> {
  const client = getSupabaseClient(); if (!client) return { layout: null, machines: [] };
  const layoutResult = await client.from("layouts").select("*").eq("venue_id", venueId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (layoutResult.error) throw layoutResult.error;
  if (!layoutResult.data) return { layout: null, machines: [] };
  const result = await client.from("layout_machines").select("id,layout_id,venue_machine_id,x_mm,y_mm,rotation").eq("layout_id", layoutResult.data.id);
  if (result.error) throw result.error;
  return {
    layout: {
      id: layoutResult.data.id,
      venueId: layoutResult.data.venue_id,
      floorPlanId: layoutResult.data.floor_plan_id,
      name: layoutResult.data.name,
      createdAt: iso(layoutResult.data.created_at),
      updatedAt: iso(layoutResult.data.updated_at),
    } as Layout,
    machines: (result.data ?? []).map((row) => ({ id: row.id, layoutId: row.layout_id, venueMachineId: row.venue_machine_id, xMm: Number(row.x_mm), yMm: Number(row.y_mm), rotation: Number(row.rotation ?? 0) })) as LayoutMachine[],
  };
}
