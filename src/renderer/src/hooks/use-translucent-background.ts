import { useCallback, useEffect, useState } from 'react'

import { getWindowMaterialController } from '@/lib/window-material-controller'
import type { TranslucentBackgroundStatus } from '../../../shared/window-contract'

export const initializeTranslucentBackground = (): Promise<TranslucentBackgroundStatus> =>
  getWindowMaterialController().initialize()

export interface TranslucentBackgroundPreference {
  enabled: boolean
  supported: boolean | null
  reducedTransparency: boolean
  setEnabled: (enabled: boolean) => void
}

export function useTranslucentBackground(): TranslucentBackgroundPreference {
  const controller = getWindowMaterialController()
  const [snapshot, setSnapshot] = useState(controller.getSnapshot)

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot)
    void controller.initialize()
    return unsubscribe
  }, [controller])

  const setEnabled = useCallback((enabled: boolean) => controller.setEnabled(enabled), [controller])

  return {
    enabled: snapshot.status?.supported === false ? false : snapshot.preferenceEnabled,
    supported: snapshot.status?.supported ?? null,
    reducedTransparency: snapshot.status?.reducedTransparency ?? false,
    setEnabled
  }
}
