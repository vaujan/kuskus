import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { notifyActionError, notifyTrashed } from '@/lib/notify'

type NotificationPreviewScenario = 'standard' | 'undo' | 'error' | 'loading'

interface KuskusDevTools {
  notification?: (scenario?: NotificationPreviewScenario) => void
}

type DevWindow = Window & {
  kuskusDev?: KuskusDevTools
}

const scenarios: NotificationPreviewScenario[] = ['standard', 'undo', 'error', 'loading']
let nextScenarioIndex = 0

export function previewNotification(scenario: NotificationPreviewScenario = 'standard'): void {
  if (scenario === 'undo') {
    notifyTrashed(1, () => toast('Undo completed'))
    return
  }
  if (scenario === 'error') {
    notifyActionError('This is a development preview of a longer error message.')
    return
  }
  if (scenario === 'loading') {
    const id = toast.loading('Testing a loading notification', {
      description: 'It will resolve automatically.'
    })
    window.setTimeout(() => {
      toast.success('Loading notification resolved', { id })
    }, 1200)
    return
  }
  toast('Notification preview', {
    description: 'Iconless, compact, and ready for visual inspection.',
    action: (
      <Button
        className="ml-auto shrink-0"
        size="sm"
        variant="secondary"
        onClick={() => toast('Preview action completed')}
      >
        Action
      </Button>
    )
  })
}

const devWindow = window as DevWindow
devWindow.kuskusDev = {
  ...devWindow.kuskusDev,
  notification: previewNotification
}

window.addEventListener('keydown', (event) => {
  if (!event.altKey || !event.shiftKey || event.key.toLocaleLowerCase() !== 't') return
  event.preventDefault()
  previewNotification(scenarios[nextScenarioIndex])
  nextScenarioIndex = (nextScenarioIndex + 1) % scenarios.length
})
