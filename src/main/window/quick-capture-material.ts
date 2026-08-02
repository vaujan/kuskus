import { isTranslucentBackgroundSupported, parseWindowsBuild } from './window-material'

export type QuickCaptureMaterial = 'acrylic' | 'opaque'
export type QuickCaptureCorners = 'native' | 'css'

export interface QuickCapturePresentation {
  material: QuickCaptureMaterial
  corners: QuickCaptureCorners
  acrylicCapable: boolean
}

export function resolveQuickCapturePresentation(
  platform: NodeJS.Platform,
  systemVersion: string,
  reducedTransparency: boolean
): QuickCapturePresentation {
  const build = parseWindowsBuild(systemVersion)
  const nativeCorners = platform === 'win32' && build !== null && build >= 22000
  const acrylicCapable = isTranslucentBackgroundSupported(platform, systemVersion)

  return {
    material: acrylicCapable && !reducedTransparency ? 'acrylic' : 'opaque',
    corners: nativeCorners ? 'native' : 'css',
    acrylicCapable
  }
}
