import type { FloorPlan, Venue } from "../../types/floorPlan";
import type { LayoutMachine } from "../../types/layout";
import type { Machine, TransferBuffer, TransferBufferItem, VenueMachine } from "../../types/machine";
import { loadCloudFloorPlan, loadCloudGlobal, loadCloudLayoutMachines, persistCloudFloorPlan, persistCloudGlobal, persistCloudLayoutMachines } from "./cloudPersistence";
import { isSupabaseConfigured } from "../supabase/client";

const databaseName = "arcade-floor-plan";
const storeName = "floor-plans";

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(databaseName, 3);
  request.onupgradeneeded = () => { const db = request.result; [storeName,"venue-machines","layout-machines","global-machine-catalog","transfer-buffers"].forEach((name) => { if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "venueId" }); }); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function loadPersistedFloorPlan(venueId: string): Promise<FloorPlan | null> {
  try { const cloud = await loadCloudFloorPlan(venueId); if (cloud) return cloud; } catch { /* local fallback keeps the pilot usable before schema setup */ }
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(venueId);
    request.onsuccess = () => resolve((request.result as FloorPlan | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function persistFloorPlan(floorPlan: FloorPlan) {
  if (isSupabaseConfigured()) await persistCloudFloorPlan(floorPlan);
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).put(floorPlan);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
}
export async function deleteVenuePersistence(venueId: string) { const database = await openDatabase(); return new Promise<void>((resolve, reject) => { const transaction = database.transaction([storeName, "layout-machines", "venue-machines"], "readwrite"); [storeName, "layout-machines", "venue-machines"].forEach((name) => transaction.objectStore(name).delete(venueId)); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); }
const read = <T,>(name: string, venueId: string) => openDatabase().then((database) => new Promise<T | null>((resolve, reject) => { const request = database.transaction(name, "readonly").objectStore(name).get(venueId); request.onsuccess = () => resolve(request.result?.value ?? null); request.onerror = () => reject(request.error); }));
const write = <T,>(name: string, venueId: string, value: T) => openDatabase().then((database) => new Promise<void>((resolve, reject) => { const request = database.transaction(name, "readwrite").objectStore(name).put({ venueId, value }); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }));
export const loadVenueMachines = (venueId: string) => read<VenueMachine[]>("venue-machines", venueId);
export const persistVenueMachines = (venueId: string, value: VenueMachine[]) => write("venue-machines", venueId, value);
export const loadLayoutMachines = (venueId: string) => read<LayoutMachine[]>("layout-machines", venueId);
export const loadPersistedLayoutMachines = async (venueId: string) => { if (isSupabaseConfigured()) { const cloud = await loadCloudLayoutMachines(venueId); if (cloud) return cloud; } return loadLayoutMachines(venueId); };
export const persistLayoutMachines = async (venueId: string, value: LayoutMachine[]) => { if (isSupabaseConfigured()) await persistCloudLayoutMachines(venueId, value); await write("layout-machines", venueId, value); };
export type PersistedGlobalState = { machines: Machine[]; venueMachines: VenueMachine[]; buffers: TransferBuffer[]; items: TransferBufferItem[]; projects?: Venue[] };
export const loadGlobalState = async () => { try { const cloud = await loadCloudGlobal(); if (cloud) return cloud; } catch { /* local fallback */ } return read<PersistedGlobalState>("transfer-buffers", "global"); };
export const persistGlobalState = async (value: PersistedGlobalState) => { if (isSupabaseConfigured()) await persistCloudGlobal(value); await write("transfer-buffers", "global", value); };
