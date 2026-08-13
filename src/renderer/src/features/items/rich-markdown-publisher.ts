import { serializerCtx } from '@milkdown/core'
import { Plugin } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

export function richMarkdownPublisher(
  publish: (markdown: string) => void
): ReturnType<typeof $prose> {
  return $prose(
    (ctx) =>
      new Plugin({
        view: () => ({
          update: (view, previousState) => {
            if (view.state.doc.eq(previousState.doc)) return
            publish(ctx.get(serializerCtx)(view.state.doc))
          }
        })
      })
  )
}
