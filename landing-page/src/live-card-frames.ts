// Load each component preview near the viewport, keeping app CSS isolated from the page.
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const frame = entry.target as HTMLIFrameElement
      frame.src = frame.dataset.sceneSrc!
      observer.unobserve(frame)
    }
  },
  { rootMargin: '300px' }
)
for (const frame of document.querySelectorAll<HTMLIFrameElement>('[data-scene-src]'))
  observer.observe(frame)
