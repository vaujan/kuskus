import { notifyLinkOpened, notifyLinkOpenFailed } from '@/lib/notify'

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
    notifyLinkOpened(describeDestination(url))
    return
  }

  notifyLinkOpenFailed(result.error, () => {
    void openExternalUrlWithFeedback(url)
  })
}
