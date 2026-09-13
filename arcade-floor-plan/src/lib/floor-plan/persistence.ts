import type { FloorPlan, Venue } from "../../types/floorPlan";
import type { Layout, LayoutMachine } from "../../types/layout";
import type { Machine, TransferBuffer, TransferBufferItem, VenueMachine } from "../../types/machine";
import { loadCloudFloorPlan, loadCloudGlobal, loadCloudLayout } from "./cloudPersistence";
import { isSupabaseConfigured } from "../supabase/client";

const databaseName = "arcade-floor-plan";
const storeName = "floor-plans";

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(databaseName, 3);
  request.onupgradeneeded = () => { const db = request.result; [storeName,"venue-machines","layout-machines","global-machine-catalog","transfer-buffers"].forEach((name) => { if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "venueId" }); }); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

/**
 * In Cloud Mode a successful empty response is authoritative. Cache is only an
 * offline/read-error fallback and is never promoted into a cloud write.
 */
export type LoadedBusinessRecord<T> = { value: T | null; source: "cloud" | "cache" };

export async function loadPersistedFloorPlan(venueId: string): Promise<LoadedBusinessRecord<FloorPlan>> {
  if (isSupabaseConfigured()) {
    try { return { value: await loadCloudFloorPlan(venueId), source: "cloud" }; } catch { /* cache may keep an offline editor readable */ }
  }
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(venueId);
    request.onsuccess = () => resolve({ value: (request.result as FloorPlan | undefined) ?? null, source: "cache" });
    request.onerror = () => reject(request.error);
  });
}

/** Cache only. User-triggered cloud writes live in cloudMutations.ts. */
export async function cacheFloorPlan(floorPlan: FloorPlan) {
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
export const cacheVenueMachines = (venueId: string, value: VenueMachine[]) => write("venue-machines", venueId, value);
export type CachedLayoutState = { layout: Layout | null; machines: LayoutMachine[] };
const asCachedLayoutState = (value: CachedLayoutState | LayoutMachine[] | null): CachedLayoutState => {
  if (Array.isArray(value)) return { layout: null, machines: value };
  return value ?? { layout: null, machines: [] };
};
export const loadLayoutMachines = async (venueId: string) => asCachedLayoutState(await read<CachedLayoutState | LayoutMachine[]>("layout-machines", venueId));
export const loadPersistedLayoutMachines = async (venueId: string) => {
  if (isSupabaseConfigured()) {
    try {
      const cloud = await loadCloudLayout(venueId);
      return { value: cloud, source: "cloud" as const };
    } catch { /* offline cache fallback only */ }
  }
  return { value: await loadLayoutMachines(venueId), source: "cache" as const };
};
export const cacheLayoutMachines = (venueId: string, value: LayoutMachine[], layout: Layout | null = null) => write("layout-machines", venueId, { layout, machines: value });
export type PersistedGlobalState = { machines: Machine[]; venueMachines: VenueMachine[]; buffers: TransferBuffer[]; items: TransferBufferItem[]; projects?: Venue[] };
export type LoadedBusinessState = { value: PersistedGlobalState; source: "cloud" | "cache" };
export const loadGlobalState = async (): Promise<LoadedBusinessState | null> => {
  if (isSupabaseConfigured()) {
    try {
      const cloud = await loadCloudGlobal();
      if (cloud) return { value: cloud, source: "cloud" };
      return { value: { machines: [], venueMachines: [], buffers: [], items: [], projects: [] }, source: "cloud" };
    } catch { /* cache is read-only offline fallback */ }
  }
  const cached = await read<PersistedGlobalState>("transfer-buffers", "global");
  return cached ? { value: cached, source: "cache" } : null;
};
/** Cache only. It must never call Supabase. */
export const cacheGlobalState = (value: PersistedGlobalState) => write("transfer-buffers", "global", value);
