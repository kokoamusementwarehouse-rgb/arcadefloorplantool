import type { Machine, VenueMachine } from "../../types/machine";
export const getEffectiveMachineDimensions = (machine: Machine, venueMachine: VenueMachine) => venueMachine.useCustomDimensions && venueMachine.customWidthMm && venueMachine.customDepthMm ? { widthMm: venueMachine.customWidthMm, depthMm: venueMachine.customDepthMm } : { widthMm: machine.widthMm, depthMm: machine.depthMm };
