/** Avoid large canvas allocations and never use a low-resolution cache at high zoom. */
export function machineTextCacheRatio(renderZoom: number, devicePixelRatio: number): number {
  return Number.isFinite(renderZoom) && renderZoom > 0 && renderZoom <= 1
    && Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 && devicePixelRatio <= 3
    ? devicePixelRatio : 0;
}

export function shouldCacheMachineText(width: number, height: number, ratio: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && Number.isFinite(ratio)
    && width > 0 && height > 0 && ratio > 0
    && width * height * ratio ** 2 <= 65536
    && width * ratio <= 512 && height * ratio <= 512;
}
