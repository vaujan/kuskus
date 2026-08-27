import { scan } from 'react-scan'

scan({
  enabled: true,
  showToolbar: true,
  useOffscreenCanvasWorker: false
})

window.__REACT_GRAB_DISABLED__ = true

const { init } = await import('react-grab')

init({
  telemetry: false,
  activationKey: 'alt+c',
  allowActivationInsideInput: false,
  freezeReactUpdates: true
})
