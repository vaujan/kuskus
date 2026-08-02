export interface RectangleLike {
  x: number
  y: number
  width: number
  height: number
}

export const QUICK_CAPTURE_GAP = 16
export const QUICK_CAPTURE_WIDTH = 416
export const QUICK_CAPTURE_MINIMUM_WIDTH = 256
export const QUICK_CAPTURE_MINIMUM_HEIGHT = 160
export const QUICK_CAPTURE_INITIAL_HEIGHT = 296

export function clampQuickCaptureHeight(requested: number, workArea: RectangleLike): number {
  const maximum = Math.max(
    QUICK_CAPTURE_MINIMUM_HEIGHT,
    Math.min(workArea.height - QUICK_CAPTURE_GAP * 2, Math.floor(workArea.height * 0.7))
  )
  if (!Number.isFinite(requested)) return QUICK_CAPTURE_INITIAL_HEIGHT
  return Math.max(QUICK_CAPTURE_MINIMUM_HEIGHT, Math.min(maximum, Math.ceil(requested)))
}

export function calculateQuickCaptureBounds(
  workArea: RectangleLike,
  requestedHeight = QUICK_CAPTURE_INITIAL_HEIGHT
): RectangleLike {
  const width = Math.max(
    QUICK_CAPTURE_MINIMUM_WIDTH,
    Math.min(QUICK_CAPTURE_WIDTH, workArea.width - QUICK_CAPTURE_GAP * 2)
  )
  const height = clampQuickCaptureHeight(requestedHeight, workArea)
  return {
    x: workArea.x + workArea.width - width - QUICK_CAPTURE_GAP,
    y: workArea.y + workArea.height - height - QUICK_CAPTURE_GAP,
    width,
    height
  }
}
