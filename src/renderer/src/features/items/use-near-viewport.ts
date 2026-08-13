import { useEffect, useState } from 'react'

const listeners = new WeakMap<Element, (visible: boolean) => void>()
let observer: IntersectionObserver | null = null

function viewportObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) listeners.get(entry.target)?.(true)
      }
    },
    { rootMargin: '600px' }
  )
  return observer
}

export function useNearViewport(enabled = true): {
  nearViewport: boolean
  observe: (element: HTMLElement | null) => void
} {
  const [element, observe] = useState<HTMLElement | null>(null)
  const [nearViewport, setNearViewport] = useState(!enabled)

  useEffect(() => {
    if (!element || !enabled || nearViewport) return
    const activeObserver = viewportObserver()
    listeners.set(element, setNearViewport)
    activeObserver.observe(element)
    return () => {
      activeObserver.unobserve(element)
      listeners.delete(element)
    }
  }, [element, enabled, nearViewport])

  return { nearViewport, observe }
}
