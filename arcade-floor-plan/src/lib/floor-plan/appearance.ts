import type { Machine } from "../../types/machine";

const palette: Record<string, { footprintColor: string; textColor: string }> = {
  claw: { footprintColor: "#fff4bd", textColor: "#573d00" },
  arcade: { footprintColor: "#dfe6ff", textColor: "#20335f" },
  racing: { footprintColor: "#d9f3ff", textColor: "#16445a" },
  shooting: { footprintColor: "#ffe0e7", textColor: "#6b2032" },
  basketball: { footprintColor: "#ffe5c5", textColor: "#66350c" },
  rhythm: { footprintColor: "#eadcff", textColor: "#43206f" },
  "kids ride": { footprintColor: "#d7f6e8", textColor: "#15543a" },
  redemption: { footprintColor: "#d9f1f4", textColor: "#124951" },
  other: { footprintColor: "#e8ebf3", textColor: "#293754" },
};
const fallback = palette.other;
export function getMachineAppearance(machine: Machine) {
  const defaults = palette[machine.category.trim().toLocaleLowerCase()] ?? fallback;
  return { footprintColor: machine.footprintColor || defaults.footprintColor, textColor: machine.footprintTextColor || defaults.textColor, borderColor: machine.footprintColor || defaults.footprintColor };
}
