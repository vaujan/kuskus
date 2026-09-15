let renderQueue = Promise.resolve()

export function renderMermaid(id: string, code: string, dark: boolean): Promise<string> {
  const render = async (): Promise<string> => {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: dark ? 'dark' : 'neutral'
    })
    return (await mermaid.render(id, code)).svg
  }
  const result = renderQueue.then(render)
  renderQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}
