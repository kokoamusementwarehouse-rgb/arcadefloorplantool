import { getSupabaseClient } from "./supabase/client";
import type { Machine, MissingPart, Shipment, ShipmentItem, ShipmentStatus, VenueMachine } from "../types/machine";
import type { Venue } from "../types/floorPlan";

const clientOrThrow = () => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
};

const toIso = (value?: string | null) => value || new Date().toISOString();
const assetStatus = (value: unknown): VenueMachine["maintenanceStatus"] =>
  value === "NEEDS_REPAIR" || value === "WAITING_PARTS" || value === "UNDER_REPAIR" ? value : "OK";

export type MachineAssetWorkspace = {
  venues: Venue[];
  models: Machine[];
  units: VenueMachine[];
  shipments: Shipment[];
  shipmentItems: ShipmentItem[];
};

export async function loadMachineAssetWorkspace(): Promise<MachineAssetWorkspace> {
  const client = clientOrThrow();
  const [venues, models, units, shipments, shipmentItems] = await Promise.all([
    client.from("venues").select("id,name").order("name"),
    client.from("catalog_machines").select("*").order("name"),
    client.from("venue_machines").select("*").order("machine_code"),
    client.from("shipments").select("*").order("created_at", { ascending: false }),
    client.from("shipment_items").select("*").order("created_at", { ascending: false }),
  ]);
  const error = [venues, models, units, shipments, shipmentItems].find((result) => result.error)?.error;
  if (error) throw error;
  return {
    venues: (venues.data ?? []) as Venue[],
    models: (models.data ?? []).map((row) => ({
      id: row.id, name: row.name, category: row.category, imageUrl: row.image_url ?? null,
      widthMm: Number(row.width_mm), depthMm: Number(row.depth_mm), heightMm: row.height_mm == null ? undefined : Number(row.height_mm),
      model: row.model ?? undefined, notes: row.notes ?? undefined, footprintColor: row.footprint_color ?? undefined,
      footprintTextColor: row.footprint_text_color ?? undefined, createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at),
    })),
    units: (units.data ?? []).map((row) => ({
      id: row.id, venueId: row.venue_id, machineId: row.machine_id, machineCode: row.machine_code,
      useCustomDimensions: Boolean(row.use_custom_dimensions), customWidthMm: row.custom_width_mm == null ? null : Number(row.custom_width_mm),
      customDepthMm: row.custom_depth_mm == null ? null : Number(row.custom_depth_mm), status: row.status === "active" ? "active" : "planned",
      transferredAt: row.transferred_at ?? null, condition: row.condition === "NEW" ? "NEW" : "USED", forSale: Boolean(row.for_sale),
      maintenanceStatus: assetStatus(row.maintenance_status), maintenanceNote: row.maintenance_note ?? null,
      missingParts: Array.isArray(row.missing_parts) ? row.missing_parts as MissingPart[] : [], receivedAt: row.received_at ?? null,
      createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at),
    })),
    shipments: (shipments.data ?? []).map((row) => ({ id: row.id, shipmentRef: row.shipment_ref ?? null, expectedArrivalDate: row.expected_arrival_date ?? null, status: row.status as ShipmentStatus, notes: row.notes ?? null, createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at) })),
    shipmentItems: (shipmentItems.data ?? []).map((row) => ({ id: row.id, shipmentId: row.shipment_id, venueMachineId: row.venue_machine_id, createdAt: toIso(row.created_at) })),
  };
}

export type VenueMachinePatch = Partial<Pick<VenueMachine, "machineCode" | "condition" | "forSale" | "maintenanceStatus" | "maintenanceNote" | "missingParts" | "receivedAt" | "venueId" | "useCustomDimensions" | "customWidthMm" | "customDepthMm">>;

/** Field-level patch only: no snapshot reconciliation and no implicit deletes. */
export async function patchVenueMachine(id: string, patch: VenueMachinePatch) {
  const client = clientOrThrow();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.machineCode !== undefined) row.machine_code = patch.machineCode;
  if (patch.condition !== undefined) row.condition = patch.condition;
  if (patch.forSale !== undefined) row.for_sale = patch.forSale;
  if (patch.maintenanceStatus !== undefined) row.maintenance_status = patch.maintenanceStatus;
  if (patch.maintenanceNote !== undefined) row.maintenance_note = patch.maintenanceNote;
  if (patch.missingParts !== undefined) row.missing_parts = patch.missingParts;
  if (patch.receivedAt !== undefined) row.received_at = patch.receivedAt;
  if (patch.venueId !== undefined) row.venue_id = patch.venueId;
  if (patch.useCustomDimensions !== undefined) row.use_custom_dimensions = patch.useCustomDimensions;
  if (patch.customWidthMm !== undefined) row.custom_width_mm = patch.customWidthMm;
  if (patch.customDepthMm !== undefined) row.custom_depth_mm = patch.customDepthMm;
  const { error } = await client.from("venue_machines").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteMachineAsset(id: string) {
  const client = clientOrThrow();
  const { error } = await client.from("venue_machines").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Explicit user command for a second physical unit.  Keeping it here means
 * the Machines page has the same narrow, command-only cloud write boundary as
 * the Floor Plan editor; route hydration never calls this function.
 */
export async function copyMachineAsset(unit: VenueMachine) {
  const id = `venue_machine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await clientOrThrow().rpc("copy_venue_machine_with_next_code", {
    p_source_id: unit.id,
    p_copy_id: id,
  });
  if (error) throw error;
  return id;
}

export type ShipmentDraft = {
  shipmentRef?: string;
  expectedArrivalDate?: string;
  status: ShipmentStatus;
  notes?: string;
  lines: Array<{
    kind: "existing";
    catalogMachineId: string;
    quantity: number;
  } | {
    kind: "new";
    name: string;
    category: string;
    widthMm: number;
    depthMm: number;
    heightMm?: number | null;
    imageDataUrl?: string | null;
    quantity: number;
  }>;
};

async function uploadShipmentMachineImage(machineId: string, dataUrl?: string | null) {
  if (!dataUrl?.startsWith("data:")) return null;
  const client = clientOrThrow();
  const mime = dataUrl.match(/^data:([^;,]+)/)?.[1] ?? "image/png";
  if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(mime)) throw new Error("Shipment machine images must be PNG, JPG, JPEG or WebP.");
  const extension = mime.split("/")[1] || "png";
  const path = `catalog/${machineId}.${extension}`;
  const response = await fetch(dataUrl);
  const upload = await client.storage.from("machine-images").upload(path, await response.blob(), { upsert: false, contentType: mime });
  if (upload.error) throw upload.error;
  return { path, url: client.storage.from("machine-images").getPublicUrl(path).data.publicUrl };
}

/** User-command boundary: image files first, then one atomic database RPC. */
export async function createShipment(draft: ShipmentDraft) {
  const client = clientOrThrow();
  const shipmentId = `shipment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const lines = draft.lines.filter((item) => item.kind === "existing" ? item.catalogMachineId && item.quantity > 0 : item.name.trim() && item.category.trim() && item.widthMm > 0 && item.depthMm > 0 && item.quantity > 0);
  if (!lines.length) throw new Error("Add at least one new machine with a name, type and dimensions.");
  const uploadedPaths: string[] = [];
  try {
    const rpcLines = [];
    for (const line of lines) {
      if (line.kind === "existing") { rpcLines.push({ mode: "existing", catalogMachineId: line.catalogMachineId, quantity: line.quantity }); continue; }
      const catalogMachineId = `machine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const uploaded = await uploadShipmentMachineImage(catalogMachineId, line.imageDataUrl);
      if (uploaded) uploadedPaths.push(uploaded.path);
      rpcLines.push({ mode: "new", catalogMachineId, name: line.name.trim(), category: line.category.trim(), widthMm: line.widthMm, depthMm: line.depthMm, heightMm: line.heightMm && line.heightMm > 0 ? line.heightMm : null, imageUrl: uploaded?.url ?? null, quantity: line.quantity });
    }
    const { error } = await client.rpc("create_shipment_with_machines", { p_shipment_id: shipmentId, p_shipment_ref: draft.shipmentRef?.trim() || null, p_expected_arrival_date: draft.expectedArrivalDate || null, p_status: draft.status, p_notes: draft.notes?.trim() || null, p_lines: rpcLines });
    if (error) throw error;
  } catch (cause) {
    if (uploadedPaths.length) {
      const firstCleanup = await client.storage.from("machine-images").remove(uploadedPaths);
      if (firstCleanup.error) {
        const retryCleanup = await client.storage.from("machine-images").remove(uploadedPaths);
        if (retryCleanup.error) {
          const original = cause instanceof Error ? cause.message : "Shipment transaction failed.";
          throw new Error(`${original} Uploaded images could not be cleaned up after two attempts: ${retryCleanup.error.message}`);
        }
      }
    }
    throw cause;
  }
}

export async function patchShipment(id: string, patch: Partial<Pick<Shipment, "shipmentRef" | "expectedArrivalDate" | "status" | "notes">>) {
  const client = clientOrThrow();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.shipmentRef !== undefined) row.shipment_ref = patch.shipmentRef || null;
  if (patch.expectedArrivalDate !== undefined) row.expected_arrival_date = patch.expectedArrivalDate || null;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.notes !== undefined) row.notes = patch.notes || null;
  const { error } = await client.from("shipments").update(row).eq("id", id);
  if (error) throw error;
}

export async function allocateShipmentMachines(ids: string[], venueId: string) {
  const client = clientOrThrow();
  const { error } = await client.from("venue_machines").update({ venue_id: venueId, received_at: new Date().toISOString(), transferred_at: null, updated_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
}
