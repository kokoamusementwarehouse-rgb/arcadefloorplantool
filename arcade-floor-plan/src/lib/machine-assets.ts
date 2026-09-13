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

export type ShipmentDraft = { shipmentRef?: string; expectedArrivalDate?: string; status: ShipmentStatus; notes?: string; lines: Array<{ machineId: string; quantity: number }> };

export async function createShipment(draft: ShipmentDraft, existingUnits: VenueMachine[]) {
  const client = clientOrThrow();
  const timestamp = new Date().toISOString();
  const shipmentId = `shipment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { error: shipmentError } = await client.from("shipments").insert({ id: shipmentId, shipment_ref: draft.shipmentRef?.trim() || null, expected_arrival_date: draft.expectedArrivalDate || null, status: draft.status, notes: draft.notes?.trim() || null, created_at: timestamp, updated_at: timestamp });
  if (shipmentError) throw shipmentError;
  const usedCodes = new Set(existingUnits.map((unit) => unit.machineCode.toLowerCase()));
  let sequence = Math.max(0, ...existingUnits.map((unit) => Number((unit.machineCode.match(/(\d+)$/) ?? ["", "0"])[1])));
  const units: Array<Record<string, unknown>> = [];
  const items: Array<Record<string, unknown>> = [];
  for (const line of draft.lines.filter((item) => item.machineId && item.quantity > 0)) {
    for (let index = 0; index < line.quantity; index += 1) {
      let code: string;
      do { sequence += 1; code = `M${String(sequence).padStart(3, "0")}`; } while (usedCodes.has(code.toLowerCase()));
      usedCodes.add(code.toLowerCase());
      const venueMachineId = `venue_machine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      units.push({ id: venueMachineId, venue_id: null, machine_id: line.machineId, machine_code: code, use_custom_dimensions: false, custom_width_mm: null, custom_depth_mm: null, status: "planned", transferred_at: null, condition: "NEW", for_sale: false, maintenance_status: "OK", maintenance_note: null, missing_parts: [], received_at: null, created_at: timestamp, updated_at: timestamp });
      items.push({ id: `shipment_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, shipment_id: shipmentId, venue_machine_id: venueMachineId, created_at: timestamp });
    }
  }
  if (!units.length) throw new Error("Add at least one machine line.");
  const { error: unitError } = await client.from("venue_machines").insert(units);
  if (unitError) throw unitError;
  const { error: itemError } = await client.from("shipment_items").insert(items);
  if (itemError) throw itemError;
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
