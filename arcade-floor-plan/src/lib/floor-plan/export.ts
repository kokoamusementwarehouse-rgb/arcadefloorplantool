import type { FloorPlan } from "../../types/floorPlan";
import type { LayoutMachine } from "../../types/layout";
import type { Machine, VenueMachine } from "../../types/machine";
import { getEffectiveMachineDimensions } from "./machineDimensions";
import { getMachineAppearance } from "./appearance";

const safeFilename = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "floor-plan";

export async function exportFloorPlanPng(input: { venueName: string; layoutName: string; floorPlan: FloorPlan; image: HTMLImageElement; layoutMachines: LayoutMachine[]; venueMachines: VenueMachine[]; machines: Machine[] }) {
  const { floorPlan, image } = input; if (!floorPlan.imageWidthPx || !floorPlan.imageHeightPx) throw new Error("Upload a floor plan before exporting.");
  const ratio = 2; const canvas = document.createElement("canvas"); canvas.width = floorPlan.imageWidthPx * ratio; canvas.height = floorPlan.imageHeightPx * ratio;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Your browser could not create an export image.");
  context.scale(ratio, ratio); context.fillStyle = "#f8faff"; context.fillRect(0, 0, floorPlan.imageWidthPx, floorPlan.imageHeightPx); context.drawImage(image, 0, 0, floorPlan.imageWidthPx, floorPlan.imageHeightPx);
  if (floorPlan.scaleMmPerPx) input.layoutMachines.forEach((layout) => { const venueMachine = input.venueMachines.find((item) => item.id === layout.venueMachineId); const machine = venueMachine && input.machines.find((item) => item.id === venueMachine.machineId); if (!venueMachine || !machine) return; const appearance = getMachineAppearance(machine); const dimensions = getEffectiveMachineDimensions(machine, venueMachine); const width = dimensions.widthMm / floorPlan.scaleMmPerPx!; const depth = dimensions.depthMm / floorPlan.scaleMmPerPx!; const x = layout.xMm / floorPlan.scaleMmPerPx!; const y = layout.yMm / floorPlan.scaleMmPerPx!; context.save(); context.translate(x, y); context.rotate((layout.rotation * Math.PI) / 180); context.fillStyle = appearance.footprintColor; context.globalAlpha = 0.82; context.strokeStyle = appearance.borderColor; context.globalAlpha = 1; context.lineWidth = 1.5; context.fillRect(-width / 2, -depth / 2, width, depth); context.strokeRect(-width / 2, -depth / 2, width, depth); context.fillStyle = appearance.textColor; context.font = `bold ${Math.max(9, Math.min(16, Math.min(width, depth) / 5))}px Inter, sans-serif`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(venueMachine.machineCode, 0, 0, Math.max(8, width - 8)); context.restore(); });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); if (!blob) throw new Error("The PNG could not be encoded.");
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${safeFilename(input.venueName)}-${safeFilename(input.layoutName)}-${new Date().toISOString().slice(0, 10)}.png`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
}
