export interface Layout {
  id: string;
  venueId: string;
  floorPlanId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutMachine {
  id: string;
  layoutId: string;
  venueMachineId: string;
  xMm: number;
  yMm: number;
  /** Degrees clockwise; existing 0/90/180/270 records remain valid. */
  rotation: number;
}
