export interface Venue { id: string; name: string; }

export interface FloorPlan {
  id: string;
  venueId: string;
  imageUrl: string | null;
  imageDataUrl: string | null;
  imageWidthPx: number;
  imageHeightPx: number;
  scaleMmPerPx: number | null;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  createdAt: string;
  updatedAt: string;
}
