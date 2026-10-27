import type { ShipmentStatus, VenueMachine } from "../types/machine";

export type ShipmentBoardStage = "in_shipping" | "arrived" | "located";

/**
 * Physical location is authoritative for the archive stage. Shipment status
 * only separates unassigned units that are still in transit from those that
 * have arrived and are waiting to be allocated.
 */
export function getShipmentBoardStage(
  status: ShipmentStatus,
  unit: Pick<VenueMachine, "venueId">,
): ShipmentBoardStage {
  if (unit.venueId !== null) return "located";
  if (status === "ARRIVED" || status === "CLOSED") return "arrived";
  return "in_shipping";
}

export function groupShipmentUnitsByStage<T extends Pick<VenueMachine, "venueId">>(
  status: ShipmentStatus,
  units: T[],
): Record<ShipmentBoardStage, T[]> {
  const groups: Record<ShipmentBoardStage, T[]> = { in_shipping: [], arrived: [], located: [] };
  for (const unit of units) groups[getShipmentBoardStage(status, unit)].push(unit);
  return groups;
}
