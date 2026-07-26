import { toast } from 'sonner'

const EXTERNAL_LINK_TOAST_ID = 'external-link-feedback'

function describeDestination(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export async function openExternalUrlWithFeedback(url: string): Promise<void> {
  const result = await window.kuskus.openExternalUrl(url)

  if (result.ok) {
    toast.success('Opened in browser', {
      id: EXTERNAL_LINK_TOAST_ID,
      description: describeDestination(url),
      duration: 2500
    })
    return
  }

  toast.error('Could not open link', {
    id: EXTERNAL_LINK_TOAST_ID,
    description: result.error,
    duration: 6000,
    action: {
      label: 'Try again',
      onClick: () => {
        void openExternalUrlWithFeedback(url)
      }
    }
  })
}
