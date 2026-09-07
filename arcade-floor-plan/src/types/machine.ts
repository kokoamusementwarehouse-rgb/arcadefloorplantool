export type MachineCategory = string;

export interface Machine {
  id: string;
  name: string;
  category: MachineCategory;
  /** Catalog-owned persisted image. Null means render the shared missing-image fallback. */
  imageUrl: string | null;
  widthMm: number;
  depthMm: number;
  /** Product height is reference data only; floor-plan footprints use width × depth. */
  heightMm?: number;
  model?: string;
  notes?: string;
  footprintColor?: string;
  footprintTextColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VenueMachine {
  id: string;
  venueId: string | null;
  machineId: string;
  machineCode: string;
  useCustomDimensions: boolean;
  customWidthMm: number | null;
  customDepthMm: number | null;
  status: "active" | "planned";
  /** Lightweight operational marker; cleared when the unit is placed. */
  transferredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransferBuffer { id: string; name: string; destinationVenueId?: string | null; createdAt: string; updatedAt: string; }
export interface TransferBufferItem { id: string; transferBufferId: string; venueMachineId: string; sourceVenueId: string | null; addedAt: string; order: number; }
