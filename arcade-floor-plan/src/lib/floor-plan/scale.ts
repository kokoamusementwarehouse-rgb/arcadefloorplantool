export const calculateScaleMmPerPx = (realDistanceMm: number, pixelDistance: number) => realDistanceMm / pixelDistance;
export const distanceBetween = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
export const isValidScaleInput = (knownDistanceMm: number, pixelDistance: number) => Number.isFinite(knownDistanceMm) && knownDistanceMm > 0 && pixelDistance > 0;
export const metresToMillimetres = (metres: number) => metres * 1000;
export const millimetresToMetres = (millimetres: number) => millimetres / 1000;
export const formatMetres = (metres: number) => `${metres >= 10 ? metres.toFixed(0) : metres.toFixed(metres < 1 ? 2 : 1).replace(/\.0$/, "")} m`;
export const niceMetres = (metres: number) => { const power = 10 ** Math.floor(Math.log10(metres)); const fraction = metres / power; const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10; return nice * power; };
/** Test calibration: the complete 2388 px KOKO Rhodes image long edge is assumed to be exactly 70 m. */
export const KOKO_RHODES_SCALE_MM_PER_PX = 70000 / 2388;
