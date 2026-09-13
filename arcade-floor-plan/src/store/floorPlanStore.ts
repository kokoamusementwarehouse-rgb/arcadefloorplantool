import { create } from "zustand";
import type { FloorPlan, Venue } from "../types/floorPlan";
import type { Layout, LayoutMachine } from "../types/layout";
import type { Machine, TransferBuffer, TransferBufferItem, VenueMachine } from "../types/machine";
import { isSupabaseConfigured } from "../lib/supabase/client";
import {
  applyLayoutUserDiff,
  createCatalogMachine as createCatalogMachineInCloud,
  createLayoutMachine as createLayoutMachineInCloud,
  createTransferBuffer as createTransferBufferInCloud,
  createVenue as createVenueInCloud,
  createVenueMachine as createVenueMachineInCloud,
  deleteFloorPlan as deleteFloorPlanInCloud,
  deleteLayoutMachine as deleteLayoutMachineInCloud,
  deleteTransferBuffer as deleteTransferBufferInCloud,
  deleteVenue as deleteVenueInCloud,
  deleteVenueMachines as deleteVenueMachinesInCloud,
  moveBufferItemsToVenue as moveBufferItemsToVenueInCloud,
  moveVenueMachinesToBuffer as moveVenueMachinesToBufferInCloud,
  patchCatalogMachine as patchCatalogMachineInCloud,
  patchFloorPlan as patchFloorPlanInCloud,
  patchLayoutMachine as patchLayoutMachineInCloud,
  patchVenueMachine as patchVenueMachineInCloud,
  renameTransferBuffer as renameTransferBufferInCloud,
  renameVenue as renameVenueInCloud,
  returnBufferItemsToSource as returnBufferItemsToSourceInCloud,
  type BusinessStateOrigin,
  type FloorPlanPatch,
  upsertUserFloorPlan,
} from "../lib/floor-plan/cloudMutations";
import {
  cacheFloorPlan,
  cacheGlobalState,
  cacheLayoutMachines,
  deleteVenuePersistence,
  type PersistedGlobalState,
} from "../lib/floor-plan/persistence";

export type EditorTool = "select" | "pan" | "calibrate";
type ReadBusinessStateOrigin = Exclude<BusinessStateOrigin, "USER_MUTATION">;
type CacheWriter = () => Promise<void>;

const now = () => new Date().toISOString();

/** Empty is intentional in Cloud Mode. Demo/fixture records must never enter a real workspace. */
export const createEmptyFloorPlan = (venueId: string): FloorPlan => ({
  id: `floor_plan_${venueId}`,
  venueId,
  imageUrl: null,
  imageDataUrl: null,
  imageWidthPx: 0,
  imageHeightPx: 0,
  scaleMmPerPx: null,
  createdAt: now(),
  updatedAt: now(),
});

export const createEmptyLayout = (venueId: string, floorPlanId = `floor_plan_${venueId}`): Layout => ({
  id: `layout_${venueId}`,
  venueId,
  floorPlanId,
  name: "Current Layout",
  createdAt: now(),
  updatedAt: now(),
});

/** Retained for callers/tests, but deliberately never seeds Cloud Mode. */
export const defaultLayoutMachines = (_venueId: string, _layoutId: string): LayoutMachine[] => [];

interface FloorPlanState {
  projects: Venue[];
  venue: Venue;
  floorPlan: FloorPlan;
  layout: Layout;
  machines: Machine[];
  venueMachines: VenueMachine[];
  layoutMachines: LayoutMachine[];
  selectedMachineId: string | null;
  hoveredVenueMachineId: string | null;
  draggingVenueMachineId: string | null;
  zoom: number;
  pan: { x: number; y: number };
  activeTool: EditorTool;
  fullStoreView: boolean;
  backgroundEditing: boolean;
  calibrationPoints: { x: number; y: number }[];
  feedback: string | null;
  persistenceStatus: "saving" | "saved" | "failed";
  lastSavedAt: string | null;
  transferBuffers: TransferBuffer[];
  transferBufferItems: TransferBufferItem[];
  hasHydrated: boolean;
  /** Documents the source of the last business-data state transition. */
  businessStateOrigin: BusinessStateOrigin;
  layoutHistory: LayoutMachine[][];
  historyIndex: number;
  selectedVenueMachineIds: string[];
  activeBufferId: string | null;
  selectedBufferItemIds: string[];

  setSelectedMachineId: (id: string | null) => void;
  setHoveredVenueMachineId: (id: string | null) => void;
  setDraggingVenueMachineId: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setActiveTool: (tool: EditorTool) => void;
  setFullStoreView: (value: boolean) => void;
  setBackgroundEditing: (value: boolean) => void;
  setVenue: (venue: Venue) => void;
  addVenue: (name: string) => Venue | null;
  renameVenue: (id: string, name: string) => void;
  deleteVenue: (id: string) => boolean;
  addVenueMachine: (machineId: string, machineCode?: string) => void;

  /** Read-only/hydration setters. They never send Supabase mutations. */
  setFloorPlan: (floorPlan: FloorPlan, origin?: ReadBusinessStateOrigin) => void;
  setLayout: (layout: Layout, origin?: ReadBusinessStateOrigin) => void;
  setCalibrationPoints: (points: { x: number; y: number }[]) => void;
  setFeedback: (message: string | null) => void;
  setPersistenceStatus: (status: "saving" | "saved" | "failed") => void;
  setHasHydrated: (value: boolean) => void;
  setVenueMachines: (items: VenueMachine[], origin?: ReadBusinessStateOrigin) => void;
  setLayoutMachines: (items: LayoutMachine[], origin?: ReadBusinessStateOrigin) => void;
  hydrateGlobal: (value: PersistedGlobalState, origin?: ReadBusinessStateOrigin) => void;

  /** Explicit user commands only. Each maps to a narrow cloud mutation. */
  saveFloorPlanUpload: (floorPlan: FloorPlan) => void;
  patchFloorPlan: (patch: FloorPlanPatch) => void;
  deleteFloorPlan: () => void;
  deleteVenueMachines: (ids: string[]) => void;
  duplicateVenueMachine: (id: string) => void;
  deleteVenueCascade: (venueId: string, options: { deleteUnusedCatalogModels: boolean }) => boolean;
  createCatalogMachine: (input: Omit<Machine, "id" | "createdAt" | "updatedAt">, addToVenue: boolean, machineCode?: string) => void;
  updateCatalogMachine: (id: string, input: Partial<Machine>) => void;
  placeMachine: (venueMachineId: string, xMm: number, yMm: number) => void;
  placeBufferMachine: (bufferItemId: string, xMm: number, yMm: number) => void;
  moveLayoutMachine: (id: string, xMm: number, yMm: number) => void;
  rotateLayoutMachine: (id: string) => void;
  previewLayoutRotation: (id: string, rotation: number) => void;
  setLayoutRotation: (id: string, rotation: number) => void;
  removeLayoutMachine: (id: string) => void;
  undoLayout: () => void;
  redoLayout: () => void;
  updateDimensions: (id: string, width: number, depth: number) => void;
  updateMachineCode: (id: string, code: string) => void;
  updateMachineCategory: (id: string, category: string) => void;
  resetDimensions: (id: string) => void;
  setCustomDimensions: (id: string, enabled: boolean) => void;
  addTransferBuffer: (name: string) => void;
  createTransferBufferAndMove: (name: string, destinationVenueId: string | null, venueMachineIds: string[]) => void;
  renameTransferBuffer: (id: string, name: string) => void;
  deleteTransferBuffer: (id: string) => void;
  setActiveBufferId: (id: string | null) => void;
  toggleVenueMachineSelection: (id: string) => void;
  moveSelectedToBuffer: (bufferId: string) => void;
  moveVenueMachinesToBuffer: (venueMachineIds: string[], bufferId: string) => void;
  toggleBufferItemSelection: (id: string) => void;
  addSelectedBufferToVenue: () => void;
  moveBufferItemsToVenue: (itemIds: string[], venueId: string) => void;
  returnSelectedToSource: () => void;
}

const emptyVenue: Venue = { id: "venue_new", name: "New venue" };

export const useFloorPlanStore = create<FloorPlanState>((set, get) => {
  let mutationQueue: Promise<void> = Promise.resolve();
  let pendingMutations = 0;
  let queueHasFailure = false;

  const cacheGlobal = async () => {
    const state = get();
    await cacheGlobalState({
      machines: state.machines,
      venueMachines: state.venueMachines,
      buffers: state.transferBuffers,
      items: state.transferBufferItems,
      projects: state.projects,
    });
  };
  const cacheLayout = (venueId: string, layout: Layout, machines: LayoutMachine[]): CacheWriter => () => cacheLayoutMachines(venueId, machines, layout);
  const cachePlan = (floorPlan: FloorPlan): CacheWriter => () => cacheFloorPlan(floorPlan);

  /**
   * The only queue allowed to call cloud commands. Hydration, realtime and
   * IndexedDB restoration never enter this queue.
   */
  const enqueueUserMutation = <T,>(
    command: () => Promise<T>,
    caches: CacheWriter[],
    failureMessage: string,
    onCloudSuccess?: (result: T) => void | Promise<void>,
  ) => {
    if (pendingMutations === 0) queueHasFailure = false;
    pendingMutations += 1;
    set({ persistenceStatus: "saving", businessStateOrigin: "USER_MUTATION" });
    const execute = async () => {
      try {
        if (isSupabaseConfigured()) {
          const result = await command();
          await onCloudSuccess?.(result);
        }
        await Promise.all(caches.map((cache) => cache()));
      } catch (error) {
        queueHasFailure = true;
        console.error("[cloud-user-mutation] command failed", error);
        set({ persistenceStatus: "failed", feedback: failureMessage });
      } finally {
        pendingMutations -= 1;
        if (pendingMutations === 0 && !queueHasFailure) set({ persistenceStatus: "saved", lastSavedAt: now() });
      }
    };
    mutationQueue = mutationQueue.then(execute, execute);
  };

  const commitLayout = (before: LayoutMachine[], after: LayoutMachine[], command: () => Promise<void>, failureMessage: string) => {
    const state = get();
    set({
      layoutMachines: after,
      layoutHistory: [...state.layoutHistory.slice(0, state.historyIndex + 1), after],
      historyIndex: state.historyIndex + 1,
      businessStateOrigin: "USER_MUTATION",
    });
    enqueueUserMutation(command, [cacheLayout(state.venue.id, state.layout, after)], failureMessage);
  };

  return {
    projects: [],
    venue: emptyVenue,
    floorPlan: createEmptyFloorPlan(emptyVenue.id),
    layout: createEmptyLayout(emptyVenue.id),
    machines: [],
    venueMachines: [],
    layoutMachines: [],
    selectedMachineId: null,
    hoveredVenueMachineId: null,
    draggingVenueMachineId: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    activeTool: "select",
    fullStoreView: false,
    backgroundEditing: false,
    calibrationPoints: [],
    feedback: null,
    persistenceStatus: "saved",
    lastSavedAt: null,
    transferBuffers: [],
    transferBufferItems: [],
    hasHydrated: false,
    businessStateOrigin: "CLOUD_HYDRATION",
    layoutHistory: [[]],
    historyIndex: 0,
    selectedVenueMachineIds: [],
    activeBufferId: null,
    selectedBufferItemIds: [],

    setSelectedMachineId: (selectedMachineId) => set({ selectedMachineId }),
    setHoveredVenueMachineId: (hoveredVenueMachineId) => set({ hoveredVenueMachineId }),
    setDraggingVenueMachineId: (draggingVenueMachineId) => set({ draggingVenueMachineId }),
    setZoom: (zoom) => set({ zoom }),
    setPan: (pan) => set({ pan }),
    setActiveTool: (activeTool) => set((state) => ({ activeTool, calibrationPoints: activeTool === "calibrate" ? [] : state.calibrationPoints })),
    setFullStoreView: (fullStoreView) => set({ fullStoreView }),
    setBackgroundEditing: (backgroundEditing) => set((state) => ({ backgroundEditing, activeTool: backgroundEditing ? "select" : state.activeTool })),

    /** Navigation only: retain the selected venue id, never its business snapshot. */
    setVenue: (venue) => {
      const state = get();
      if (state.venue.id === venue.id) return;
      if (typeof window !== "undefined") localStorage.setItem("floorplan-active-venue", venue.id);
      const floorPlan = createEmptyFloorPlan(venue.id);
      const layout = createEmptyLayout(venue.id, floorPlan.id);
      set({
        venue,
        floorPlan,
        layout,
        layoutMachines: [],
        layoutHistory: [[]],
        historyIndex: 0,
        selectedMachineId: null,
        hoveredVenueMachineId: null,
        draggingVenueMachineId: null,
        selectedVenueMachineIds: [],
        selectedBufferItemIds: [],
        zoom: 1,
        pan: { x: 0, y: 0 },
        activeTool: "select",
        backgroundEditing: false,
        calibrationPoints: [],
        businessStateOrigin: "CLOUD_HYDRATION",
      });
    },

    addVenue: (name) => {
      const clean = name.trim();
      if (!clean) return null;
      const venue = { id: `venue_${Date.now()}_${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "new"}`, name: clean };
      set((state) => ({ projects: [...state.projects, venue], businessStateOrigin: "USER_MUTATION" }));
      get().setVenue(venue);
      enqueueUserMutation(() => createVenueInCloud(venue), [cacheGlobal], "Venue could not be saved to cloud.");
      return venue;
    },

    renameVenue: (id, name) => {
      const clean = name.trim();
      const state = get();
      if (!clean || !state.projects.some((item) => item.id === id)) return;
      set((current) => ({
        projects: current.projects.map((item) => item.id === id ? { ...item, name: clean } : item),
        venue: current.venue.id === id ? { ...current.venue, name: clean } : current.venue,
        businessStateOrigin: "USER_MUTATION",
      }));
      enqueueUserMutation(() => renameVenueInCloud(id, clean), [cacheGlobal], "Venue name could not be saved to cloud.");
    },

    deleteVenue: (id) => get().deleteVenueCascade(id, { deleteUnusedCatalogModels: false }),

    addVenueMachine: (machineId, machineCode) => {
      const state = get();
      if (!state.machines.some((machine) => machine.id === machineId)) {
        set({ feedback: "That catalog machine is unavailable." });
        return;
      }
      const venueItems = state.venueMachines.filter((item) => item.venueId === state.venue.id);
      const code = machineCode?.trim() || `M${String(venueItems.length + 1).padStart(2, "0")}`;
      if (venueItems.some((item) => item.machineCode.toLocaleLowerCase() === code.toLocaleLowerCase())) {
        set({ feedback: `Machine code ${code} already exists in this venue.` });
        return;
      }
      const item: VenueMachine = {
        id: `venue_machine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        venueId: state.venue.id,
        machineId,
        machineCode: code,
        useCustomDimensions: false,
        customWidthMm: null,
        customDepthMm: null,
        status: "planned",
        transferredAt: null,
        condition: "USED",
        forSale: false,
        maintenanceStatus: "OK",
        maintenanceNote: null,
        missingParts: [],
        receivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      set((current) => ({ venueMachines: [...current.venueMachines, item], selectedMachineId: item.id, feedback: `${item.machineCode} added. Drag it onto the calibrated plan.`, businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => createVenueMachineInCloud(item), [cacheGlobal], "Machine could not be saved to cloud.");
    },

    setFloorPlan: (floorPlan, origin = "CLOUD_HYDRATION") => set({ floorPlan, businessStateOrigin: origin }),
    setLayout: (layout, origin = "CLOUD_HYDRATION") => set({ layout, businessStateOrigin: origin }),
    setCalibrationPoints: (calibrationPoints) => set({ calibrationPoints }),
    setFeedback: (feedback) => set({ feedback }),
    setPersistenceStatus: (persistenceStatus) => set((state) => ({ persistenceStatus, lastSavedAt: persistenceStatus === "saved" ? now() : state.lastSavedAt })),
    setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    setVenueMachines: (venueMachines, origin = "CLOUD_HYDRATION") => set({ venueMachines, businessStateOrigin: origin }),
    setLayoutMachines: (layoutMachines, origin = "CLOUD_HYDRATION") => set({ layoutMachines, layoutHistory: [layoutMachines], historyIndex: 0, businessStateOrigin: origin }),

    saveFloorPlanUpload: (floorPlan) => {
      set({ floorPlan, businessStateOrigin: "USER_MUTATION" });
      enqueueUserMutation(() => upsertUserFloorPlan(floorPlan), [cachePlan(floorPlan)], "The floor plan could not be saved to cloud.");
    },

    patchFloorPlan: (patch) => {
      const state = get();
      const next: FloorPlan = { ...state.floorPlan, ...patch, updatedAt: now() };
      set({ floorPlan: next, businessStateOrigin: "USER_MUTATION" });
      enqueueUserMutation(() => patchFloorPlanInCloud(next.id, patch), [cachePlan(next)], "Floor plan changes could not be saved to cloud.");
    },

    deleteFloorPlan: () => {
      const state = get();
      const emptyPlan = createEmptyFloorPlan(state.venue.id);
      const emptyLayout = createEmptyLayout(state.venue.id, emptyPlan.id);
      set({
        floorPlan: emptyPlan,
        layout: emptyLayout,
        calibrationPoints: [],
        layoutMachines: [],
        layoutHistory: [[]],
        historyIndex: 0,
        backgroundEditing: false,
        selectedMachineId: null,
        feedback: `${state.layoutMachines.length ? `${state.layoutMachines.length} machines are now Unplaced.` : "Floor Plan and calibration removed."}`,
        businessStateOrigin: "USER_MUTATION",
      });
      enqueueUserMutation(
        () => deleteFloorPlanInCloud(state.venue.id),
        [cachePlan(emptyPlan), cacheLayout(state.venue.id, emptyLayout, [])],
        "Floor plan could not be deleted from cloud.",
      );
    },

    deleteVenueMachines: (ids) => {
      const state = get();
      const requested = new Set(ids);
      const deleted = new Set(state.venueMachines.filter((item) => requested.has(item.id)).map((item) => item.id));
      if (!deleted.size) {
        set({ feedback: "No machines selected." });
        return;
      }
      const nextLayout = state.layoutMachines.filter((item) => !deleted.has(item.venueMachineId));
      set({
        venueMachines: state.venueMachines.filter((item) => !deleted.has(item.id)),
        layoutMachines: nextLayout,
        layoutHistory: [...state.layoutHistory.slice(0, state.historyIndex + 1), nextLayout],
        historyIndex: state.historyIndex + 1,
        transferBufferItems: state.transferBufferItems.filter((item) => !deleted.has(item.venueMachineId)),
        selectedVenueMachineIds: state.selectedVenueMachineIds.filter((id) => !deleted.has(id)),
        selectedBufferItemIds: state.selectedBufferItemIds.filter((id) => {
          const item = state.transferBufferItems.find((entry) => entry.id === id);
          return !item || !deleted.has(item.venueMachineId);
        }),
        selectedMachineId: deleted.has(state.selectedMachineId ?? "") ? null : state.selectedMachineId,
        feedback: `${deleted.size} machine${deleted.size === 1 ? "" : "s"} deleted.`,
        businessStateOrigin: "USER_MUTATION",
      });
      enqueueUserMutation(() => deleteVenueMachinesInCloud([...deleted]), [cacheGlobal, cacheLayout(state.venue.id, state.layout, nextLayout)], "Machine deletion could not be saved to cloud.");
    },

    duplicateVenueMachine: (id) => {
      const state = get();
      const source = state.venueMachines.find((item) => item.id === id);
      if (!source || source.venueId !== state.venue.id) {
        set({ feedback: "Choose a machine in the current venue to copy." });
        return;
      }
      const used = new Set(state.venueMachines.filter((item) => item.venueId === state.venue.id).map((item) => item.machineCode.toLocaleLowerCase()));
      const base = source.machineCode.replace(/-\d+$/, "");
      let suffix = 2;
      let code = `${base}-${suffix}`;
      while (used.has(code.toLocaleLowerCase())) { suffix += 1; code = `${base}-${suffix}`; }
      const timestamp = now();
      const copy: VenueMachine = { ...source, id: `venue_machine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, machineCode: code, status: "planned", transferredAt: null, createdAt: timestamp, updatedAt: timestamp };
      set((current) => ({ venueMachines: [...current.venueMachines, copy], selectedMachineId: copy.id, selectedVenueMachineIds: [], feedback: `${current.machines.find((machine) => machine.id === source.machineId)?.name ?? "Machine"} copied as ${code}.`, businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => createVenueMachineInCloud(copy), [cacheGlobal], "Machine copy could not be saved to cloud.");
    },

    deleteVenueCascade: (venueId, options) => {
      const state = get();
      const target = state.projects.find((project) => project.id === venueId);
      if (!target) return false;
      const owned = state.venueMachines.filter((item) => item.venueId === venueId);
      const ids = new Set(owned.map((item) => item.id));
      const affectedModels = new Set(owned.map((item) => item.machineId));
      const unusedCatalogIds = options.deleteUnusedCatalogModels
        ? state.machines.filter((machine) => affectedModels.has(machine.id) && !state.venueMachines.some((item) => !ids.has(item.id) && item.machineId === machine.id)).map((machine) => machine.id)
        : [];
      const remainingProjects = state.projects.filter((project) => project.id !== venueId);
      const nextVenue = remainingProjects[0] ?? emptyVenue;
      const nextMachines = state.machines.filter((machine) => !unusedCatalogIds.includes(machine.id));
      const nextLayout = state.venue.id === venueId ? [] : state.layoutMachines.filter((item) => !ids.has(item.venueMachineId));
      const nextFloorPlan = state.venue.id === venueId ? createEmptyFloorPlan(nextVenue.id) : state.floorPlan;
      const nextLayoutRecord = state.venue.id === venueId ? createEmptyLayout(nextVenue.id, nextFloorPlan.id) : state.layout;
      set({
        projects: remainingProjects,
        machines: nextMachines,
        venueMachines: state.venueMachines.filter((item) => !ids.has(item.id)),
        transferBufferItems: state.transferBufferItems.filter((item) => !ids.has(item.venueMachineId)),
        layoutMachines: nextLayout,
        layoutHistory: [nextLayout],
        historyIndex: 0,
        venue: state.venue.id === venueId ? nextVenue : state.venue,
        floorPlan: nextFloorPlan,
        layout: nextLayoutRecord,
        selectedMachineId: null,
        selectedVenueMachineIds: [],
        selectedBufferItemIds: [],
        feedback: `${target.name} deleted.`,
        businessStateOrigin: "USER_MUTATION",
      });
      enqueueUserMutation(
        () => deleteVenueInCloud(venueId, unusedCatalogIds),
        [cacheGlobal, cacheLayout(state.venue.id, nextLayoutRecord, nextLayout), cachePlan(nextFloorPlan)],
        "Venue deletion could not be saved to cloud.",
        async () => { await deleteVenuePersistence(venueId); },
      );
      return true;
    },

    createCatalogMachine: (input, addToVenue, machineCode) => {
      const state = get();
      const timestamp = now();
      const machine: Machine = { ...input, id: `machine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: timestamp, updatedAt: timestamp };
      let unit: VenueMachine | null = null;
      if (addToVenue) {
        const existing = state.venueMachines.filter((item) => item.venueId === state.venue.id);
        const code = machineCode?.trim() || `M${String(existing.length + 1).padStart(2, "0")}`;
        if (existing.some((item) => item.machineCode.toLowerCase() === code.toLowerCase())) {
          set({ feedback: `Machine code ${code} already exists in this venue.` });
          return;
        }
        unit = { id: `venue_machine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, venueId: state.venue.id, machineId: machine.id, machineCode: code, useCustomDimensions: false, customWidthMm: null, customDepthMm: null, status: "planned", transferredAt: null, condition: "USED", forSale: false, maintenanceStatus: "OK", maintenanceNote: null, missingParts: [], receivedAt: null, createdAt: timestamp, updatedAt: timestamp };
      }
      set((current) => ({ machines: [...current.machines, machine], venueMachines: unit ? [...current.venueMachines, unit] : current.venueMachines, selectedMachineId: unit?.id ?? current.selectedMachineId, feedback: unit ? `${unit.machineCode} added to ${current.venue.name} as Unplaced.` : `${machine.name} saved to Machine Catalog.`, businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(
        async () => {
          const uploadedUrl = await createCatalogMachineInCloud(machine);
          if (unit) await createVenueMachineInCloud(unit);
          return uploadedUrl;
        },
        [cacheGlobal],
        "Machine could not be saved to cloud.",
        (uploadedUrl) => {
          if (!uploadedUrl || uploadedUrl === machine.imageUrl) return;
          set((current) => ({ machines: current.machines.map((item) => item.id === machine.id ? { ...item, imageUrl: uploadedUrl } : item) }));
        },
      );
    },

    updateCatalogMachine: (id, input) => {
      const state = get();
      if (!state.machines.some((machine) => machine.id === id)) return;
      set((current) => ({ machines: current.machines.map((machine) => machine.id === id ? { ...machine, ...input, updatedAt: now() } : machine), businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => patchCatalogMachineInCloud(id, input), [cacheGlobal], "Machine model could not be saved to cloud.");
    },

    placeMachine: (venueMachineId, xMm, yMm) => {
      const state = get();
      if (state.layoutMachines.some((item) => item.venueMachineId === venueMachineId)) {
        set({ feedback: "This machine is already placed." });
        return;
      }
      const placed: LayoutMachine = { id: `layout_machine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, layoutId: state.layout.id, venueMachineId, xMm, yMm, rotation: 0 };
      const next = [...state.layoutMachines, placed];
      commitLayout(state.layoutMachines, next, () => createLayoutMachineInCloud(state.layout, placed), "Machine placement could not be saved to cloud.");
      set({ selectedMachineId: venueMachineId });
    },

    placeBufferMachine: () => set({ feedback: "Add this machine to a venue first, then place it from Venue Machines." }),

    moveLayoutMachine: (id, xMm, yMm) => {
      const state = get();
      const original = state.layoutMachines.find((item) => item.id === id);
      if (!original || (original.xMm === xMm && original.yMm === yMm)) return;
      const next = state.layoutMachines.map((item) => item.id === id ? { ...item, xMm, yMm } : item);
      commitLayout(state.layoutMachines, next, () => patchLayoutMachineInCloud(id, { xMm, yMm }), "Machine position could not be saved to cloud.");
    },

    rotateLayoutMachine: (id) => {
      const state = get();
      const original = state.layoutMachines.find((item) => item.id === id);
      if (!original) return;
      const rotation = (original.rotation + 90) % 360;
      const next = state.layoutMachines.map((item) => item.id === id ? { ...item, rotation } : item);
      commitLayout(state.layoutMachines, next, () => patchLayoutMachineInCloud(id, { rotation }), "Machine rotation could not be saved to cloud.");
    },

    /** Visual preview only: selection-overlay mouse movement never persists. */
    previewLayoutRotation: (id, rotation) => set((state) => ({ layoutMachines: state.layoutMachines.map((item) => item.id === id ? { ...item, rotation: ((rotation % 360) + 360) % 360 } : item), businessStateOrigin: "USER_MUTATION" })),

    setLayoutRotation: (id, rotation) => {
      const state = get();
      const original = state.layoutMachines.find((item) => item.id === id);
      if (!original) return;
      const normalized = ((rotation % 360) + 360) % 360;
      const next = state.layoutMachines.map((item) => item.id === id ? { ...item, rotation: normalized } : item);
      commitLayout(state.layoutMachines, next, () => patchLayoutMachineInCloud(id, { rotation: normalized }), "Machine rotation could not be saved to cloud.");
    },

    removeLayoutMachine: (id) => {
      const state = get();
      const removed = state.layoutMachines.find((item) => item.id === id);
      if (!removed) return;
      const next = state.layoutMachines.filter((item) => item.id !== id);
      commitLayout(state.layoutMachines, next, () => deleteLayoutMachineInCloud(id), "Machine could not be removed from cloud layout.");
      if (removed.venueMachineId === state.selectedMachineId) set({ selectedMachineId: null });
    },

    undoLayout: () => {
      const state = get();
      if (state.historyIndex <= 0) return;
      const before = state.layoutMachines;
      const after = state.layoutHistory[state.historyIndex - 1];
      set({ layoutMachines: after, historyIndex: state.historyIndex - 1, businessStateOrigin: "USER_MUTATION" });
      enqueueUserMutation(() => applyLayoutUserDiff(state.layout, before, after), [cacheLayout(state.venue.id, state.layout, after)], "Undo could not be saved to cloud.");
    },

    redoLayout: () => {
      const state = get();
      if (state.historyIndex >= state.layoutHistory.length - 1) return;
      const before = state.layoutMachines;
      const after = state.layoutHistory[state.historyIndex + 1];
      set({ layoutMachines: after, historyIndex: state.historyIndex + 1, businessStateOrigin: "USER_MUTATION" });
      enqueueUserMutation(() => applyLayoutUserDiff(state.layout, before, after), [cacheLayout(state.venue.id, state.layout, after)], "Redo could not be saved to cloud.");
    },

    updateDimensions: (id, width, depth) => {
      const state = get();
      const target = state.venueMachines.find((item) => item.id === id);
      if (!target) return;
      if (target.useCustomDimensions) {
        set((current) => ({ venueMachines: current.venueMachines.map((item) => item.id === id ? { ...item, customWidthMm: width, customDepthMm: depth, updatedAt: now() } : item), businessStateOrigin: "USER_MUTATION" }));
        enqueueUserMutation(() => patchVenueMachineInCloud(id, { customWidthMm: width, customDepthMm: depth }), [cacheGlobal], "Custom dimensions could not be saved to cloud.");
        return;
      }
      set((current) => ({ machines: current.machines.map((machine) => machine.id === target.machineId ? { ...machine, widthMm: width, depthMm: depth, updatedAt: now() } : machine), businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => patchCatalogMachineInCloud(target.machineId, { widthMm: width, depthMm: depth }), [cacheGlobal], "Machine dimensions could not be saved to cloud.");
    },

    updateMachineCode: (id, code) => {
      const state = get();
      const target = state.venueMachines.find((item) => item.id === id);
      const clean = code.trim();
      if (!target || !clean) {
        set({ feedback: "Machine code cannot be empty." });
        return;
      }
      if (state.venueMachines.some((item) => item.id !== id && item.venueId === target.venueId && item.machineCode.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
        set({ feedback: `Machine code ${clean} already exists in this venue.` });
        return;
      }
      set((current) => ({ venueMachines: current.venueMachines.map((item) => item.id === id ? { ...item, machineCode: clean, updatedAt: now() } : item), feedback: `${clean} updated.`, businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => patchVenueMachineInCloud(id, { machineCode: clean }), [cacheGlobal], "Machine code could not be saved to cloud.");
    },

    updateMachineCategory: (id, category) => {
      const state = get();
      const target = state.venueMachines.find((item) => item.id === id);
      const clean = category.trim();
      if (!target || !clean) return;
      const canonical = state.machines.find((machine) => machine.category.trim().toLocaleLowerCase() === clean.toLocaleLowerCase())?.category ?? clean;
      set((current) => ({ machines: current.machines.map((machine) => machine.id === target.machineId ? { ...machine, category: canonical, updatedAt: now() } : machine), businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => patchCatalogMachineInCloud(target.machineId, { category: canonical }), [cacheGlobal], "Machine category could not be saved to cloud.");
    },

    resetDimensions: (id) => {
      const state = get();
      if (!state.venueMachines.some((item) => item.id === id)) return;
      set((current) => ({ venueMachines: current.venueMachines.map((item) => item.id === id ? { ...item, useCustomDimensions: false, customWidthMm: null, customDepthMm: null, updatedAt: now() } : item), businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => patchVenueMachineInCloud(id, { useCustomDimensions: false, customWidthMm: null, customDepthMm: null }), [cacheGlobal], "Standard dimensions could not be saved to cloud.");
    },

    setCustomDimensions: (id, enabled) => {
      const state = get();
      const item = state.venueMachines.find((entry) => entry.id === id);
      const machine = item && state.machines.find((entry) => entry.id === item.machineId);
      if (!item || !machine) return;
      const customWidthMm = enabled ? (item.customWidthMm ?? machine.widthMm) : null;
      const customDepthMm = enabled ? (item.customDepthMm ?? machine.depthMm) : null;
      set((current) => ({ venueMachines: current.venueMachines.map((entry) => entry.id === id ? { ...entry, useCustomDimensions: enabled, customWidthMm, customDepthMm, updatedAt: now() } : entry), businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => patchVenueMachineInCloud(id, { useCustomDimensions: enabled, customWidthMm, customDepthMm }), [cacheGlobal], "Custom dimensions could not be saved to cloud.");
    },

    addTransferBuffer: (name) => {
      const clean = name.trim();
      if (!clean) return;
      const buffer: TransferBuffer = { id: `buffer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: clean, createdAt: now(), updatedAt: now() };
      set((state) => ({ transferBuffers: [...state.transferBuffers, buffer], businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => createTransferBufferInCloud(buffer), [cacheGlobal], "Transfer Buffer could not be saved to cloud.");
    },

    createTransferBufferAndMove: (name, destinationVenueId, venueMachineIds) => {
      const state = get();
      const clean = name.trim();
      const ids = [...new Set(venueMachineIds)];
      if (!clean || !ids.length) {
        set({ feedback: "Enter a buffer name and select at least one machine." });
        return;
      }
      const eligible = state.venueMachines.filter((machine) => ids.includes(machine.id) && machine.venueId !== null);
      if (eligible.length !== ids.length) {
        set({ feedback: "Transfer cancelled: selected machines are unavailable." });
        return;
      }
      const timestamp = now();
      const buffer: TransferBuffer = { id: `buffer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: clean, destinationVenueId: destinationVenueId || undefined, createdAt: timestamp, updatedAt: timestamp };
      const items: TransferBufferItem[] = eligible.map((machine, order) => ({ id: `buffer_item_${Date.now()}_${order}_${Math.random().toString(36).slice(2, 6)}`, transferBufferId: buffer.id, venueMachineId: machine.id, sourceVenueId: machine.venueId, addedAt: timestamp, order }));
      const movedIds = new Set(eligible.map((machine) => machine.id));
      const nextLayout = state.layoutMachines.filter((item) => !movedIds.has(item.venueMachineId));
      set({ transferBuffers: [...state.transferBuffers, buffer], transferBufferItems: [...state.transferBufferItems, ...items], venueMachines: state.venueMachines.map((machine) => movedIds.has(machine.id) ? { ...machine, venueId: null, transferredAt: null, updatedAt: timestamp } : machine), layoutMachines: nextLayout, layoutHistory: [...state.layoutHistory.slice(0, state.historyIndex + 1), nextLayout], historyIndex: state.historyIndex + 1, selectedVenueMachineIds: [], selectedMachineId: null, activeBufferId: buffer.id, feedback: `${eligible.length} machine${eligible.length === 1 ? "" : "s"} moved to ${clean}.`, businessStateOrigin: "USER_MUTATION" });
      enqueueUserMutation(async () => { await createTransferBufferInCloud(buffer); await moveVenueMachinesToBufferInCloud({ venueMachineIds: eligible.map((machine) => machine.id), bufferItems: items }); }, [cacheGlobal, cacheLayout(state.venue.id, state.layout, nextLayout)], "Transfer could not be saved to cloud.");
    },

    renameTransferBuffer: (id, name) => {
      const clean = name.trim();
      if (!clean || !get().transferBuffers.some((buffer) => buffer.id === id)) return;
      set((state) => ({ transferBuffers: state.transferBuffers.map((buffer) => buffer.id === id ? { ...buffer, name: clean, updatedAt: now() } : buffer), businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => renameTransferBufferInCloud(id, clean), [cacheGlobal], "Transfer Buffer name could not be saved to cloud.");
    },

    deleteTransferBuffer: (id) => {
      const state = get();
      if (state.transferBufferItems.some((item) => item.transferBufferId === id)) {
        set({ feedback: "Move or return machines before deleting this buffer." });
        return;
      }
      set((current) => ({ transferBuffers: current.transferBuffers.filter((buffer) => buffer.id !== id), activeBufferId: current.activeBufferId === id ? null : current.activeBufferId, businessStateOrigin: "USER_MUTATION" }));
      enqueueUserMutation(() => deleteTransferBufferInCloud(id), [cacheGlobal], "Transfer Buffer could not be deleted from cloud.");
    },

    setActiveBufferId: (activeBufferId) => set({ activeBufferId, selectedBufferItemIds: [] }),
    toggleVenueMachineSelection: (id) => set((state) => ({ selectedVenueMachineIds: state.selectedVenueMachineIds.includes(id) ? state.selectedVenueMachineIds.filter((item) => item !== id) : [...state.selectedVenueMachineIds, id] })),
    moveSelectedToBuffer: (bufferId) => get().moveVenueMachinesToBuffer(get().selectedVenueMachineIds, bufferId),

    moveVenueMachinesToBuffer: (ids, bufferId) => {
      const state = get();
      const requestedIds = [...new Set(ids)];
      if (!requestedIds.length || !state.transferBuffers.some((buffer) => buffer.id === bufferId)) {
        set({ feedback: "Choose a valid Transfer Buffer." });
        return;
      }
      const already = new Set(state.transferBufferItems.map((item) => item.venueMachineId));
      const eligible = state.venueMachines.filter((machine) => requestedIds.includes(machine.id) && machine.venueId !== null && !already.has(machine.id));
      if (eligible.length !== requestedIds.length) {
        set({ feedback: "Transfer cancelled: one or more machines are already in a Transfer Buffer." });
        return;
      }
      const timestamp = now();
      const items: TransferBufferItem[] = eligible.map((machine, order) => ({ id: `buffer_item_${Date.now()}_${order}_${Math.random().toString(36).slice(2, 6)}`, transferBufferId: bufferId, venueMachineId: machine.id, sourceVenueId: machine.venueId, addedAt: timestamp, order }));
      const transferIds = new Set(eligible.map((machine) => machine.id));
      const nextLayout = state.layoutMachines.filter((item) => !transferIds.has(item.venueMachineId));
      set({ venueMachines: state.venueMachines.map((machine) => transferIds.has(machine.id) ? { ...machine, venueId: null, transferredAt: null, updatedAt: timestamp } : machine), transferBufferItems: [...state.transferBufferItems, ...items], layoutMachines: nextLayout, layoutHistory: [...state.layoutHistory.slice(0, state.historyIndex + 1), nextLayout], historyIndex: state.historyIndex + 1, selectedVenueMachineIds: [], selectedMachineId: transferIds.has(state.selectedMachineId ?? "") ? null : state.selectedMachineId, feedback: `${eligible.length} machine${eligible.length === 1 ? "" : "s"} moved to Transfer Buffer.`, businessStateOrigin: "USER_MUTATION" });
      enqueueUserMutation(() => moveVenueMachinesToBufferInCloud({ venueMachineIds: eligible.map((machine) => machine.id), bufferItems: items }), [cacheGlobal, cacheLayout(state.venue.id, state.layout, nextLayout)], "Transfer could not be saved to cloud.");
    },

    toggleBufferItemSelection: (id) => set((state) => ({ selectedBufferItemIds: state.selectedBufferItemIds.includes(id) ? state.selectedBufferItemIds.filter((item) => item !== id) : [...state.selectedBufferItemIds, id] })),
    addSelectedBufferToVenue: () => get().moveBufferItemsToVenue(get().selectedBufferItemIds, get().venue.id),

    moveBufferItemsToVenue: (itemIds, venueId) => {
      const state = get();
      const selected = state.transferBufferItems.filter((item) => itemIds.includes(item.id));
      const destination = state.projects.find((project) => project.id === venueId);
      if (!destination || selected.length !== itemIds.length || new Set(selected.map((item) => item.venueMachineId)).size !== selected.length) {
        set({ feedback: "Transfer cancelled: destination or buffer items are unavailable." });
        return;
      }
      const ids = selected.map((item) => item.venueMachineId);
      const physical = ids.map((id) => state.venueMachines.find((machine) => machine.id === id));
      if (physical.some((machine) => !machine || machine.venueId !== null)) {
        set({ feedback: "Transfer cancelled: an item is no longer in the Transfer Buffer." });
        return;
      }
      const destinationCodes = new Set(state.venueMachines.filter((machine) => machine.venueId === venueId).map((machine) => machine.machineCode.toLocaleLowerCase()));
      const incomingCodes = new Set<string>();
      const conflict = physical.find((machine) => {
        const code = machine!.machineCode.toLocaleLowerCase();
        if (destinationCodes.has(code) || incomingCodes.has(code)) return true;
        incomingCodes.add(code);
        return false;
      });
      if (conflict) {
        set({ feedback: `${conflict.machineCode} already exists in ${destination.name}. Transfer cancelled.` });
        return;
      }
      const transferredAt = now();
      set({ venueMachines: state.venueMachines.map((machine) => ids.includes(machine.id) ? { ...machine, venueId, transferredAt, updatedAt: transferredAt } : machine), transferBufferItems: state.transferBufferItems.filter((item) => !itemIds.includes(item.id)), selectedBufferItemIds: [], feedback: `${ids.length} machine${ids.length === 1 ? "" : "s"} moved to ${destination.name} as Unplaced.`, businessStateOrigin: "USER_MUTATION" });
      enqueueUserMutation(() => moveBufferItemsToVenueInCloud({ itemIds, venueMachineIds: ids, venueId, transferredAt }), [cacheGlobal], "Transfer could not be saved to cloud.");
    },

    returnSelectedToSource: () => {
      const state = get();
      const selected = state.transferBufferItems.filter((item) => state.selectedBufferItemIds.includes(item.id));
      if (!selected.length) return;
      const sourceByMachine = new Map(selected.map((item) => [item.venueMachineId, item.sourceVenueId]));
      set({ venueMachines: state.venueMachines.map((machine) => sourceByMachine.has(machine.id) ? { ...machine, venueId: sourceByMachine.get(machine.id) ?? null, updatedAt: now() } : machine), transferBufferItems: state.transferBufferItems.filter((item) => !state.selectedBufferItemIds.includes(item.id)), selectedBufferItemIds: [], businessStateOrigin: "USER_MUTATION" });
      enqueueUserMutation(() => returnBufferItemsToSourceInCloud({ items: selected }), [cacheGlobal], "Return to source venue could not be saved to cloud.");
    },

    hydrateGlobal: (value, origin = "CLOUD_HYDRATION") => set({
      machines: value.machines,
      venueMachines: value.venueMachines,
      projects: value.projects ?? [],
      transferBuffers: value.buffers,
      transferBufferItems: value.items,
      businessStateOrigin: origin,
    }),
  };
});
