import type { TranslucentBackgroundStatus } from '../../shared/window-contract'

export const WINDOWS_BACKGROUND_MATERIAL_MINIMUM_BUILD = 22621
export const OPAQUE_WINDOW_BACKGROUND = '#181c1d'

export interface WindowMaterialTarget {
  setBackgroundColor: (backgroundColor: string) => void
  setBackgroundMaterial: (material: 'acrylic' | 'none') => void
}

export function parseWindowsBuild(systemVersion: string): number | null {
  const segments = systemVersion.split('.')
  if (segments.length < 3) return null
  const build = Number.parseInt(segments[2], 10)
  return Number.isInteger(build) && build >= 0 ? build : null
}

export function isTranslucentBackgroundSupported(
  platform: NodeJS.Platform,
  systemVersion: string
): boolean {
  if (platform === 'linux') return true
  if (platform !== 'win32') return false
  const build = parseWindowsBuild(systemVersion)
  return build !== null && build >= WINDOWS_BACKGROUND_MATERIAL_MINIMUM_BUILD
}

export function parseTranslucentBackgroundRequest(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Translucent background must be a boolean.')
  return value
}

export function resolveTranslucentBackgroundStatus(
  platform: NodeJS.Platform,
  systemVersion: string,
  requested: boolean,
  reducedTransparency: boolean
): TranslucentBackgroundStatus {
  const supported = isTranslucentBackgroundSupported(platform, systemVersion)
  return {
    supported,
    enabled: supported && requested && !reducedTransparency,
    reducedTransparency: supported && reducedTransparency
  }
}

export function applyTranslucentBackground(
  window: WindowMaterialTarget,
  platform: NodeJS.Platform,
  systemVersion: string,
  requested: boolean,
  reducedTransparency: boolean
): TranslucentBackgroundStatus {
  const status = resolveTranslucentBackgroundStatus(
    platform,
    systemVersion,
    requested,
    reducedTransparency
  )

  if (platform === 'linux') {
    window.setBackgroundColor(status.enabled ? '#00000000' : OPAQUE_WINDOW_BACKGROUND)
    return status
  }

  if (status.enabled) {
    window.setBackgroundColor('#00000000')
    window.setBackgroundMaterial('acrylic')
  } else {
    window.setBackgroundMaterial('none')
    window.setBackgroundColor(OPAQUE_WINDOW_BACKGROUND)
  }

  return status
}
