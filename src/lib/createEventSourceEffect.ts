import debounce from "debounce"
import { createEffect, onCleanup } from "solid-js"
import { Toaster } from "@gazatu/solid-spectre/ui/Toaster"

const createEventSourceEffect = (effect: (ev: MessageEvent) => void, getUrl: () => Promise<string | URL | null>) => {
  let events: EventSource | undefined

  createEffect(() => {
    void (async () => {
      try {
        const url = await getUrl()
        if (!url) {
          return
        }

        events = new EventSource(url)
        events.onmessage = debounce(effect, 1000)
      } catch (error) {
        Toaster.pushError(error)
      }
    })()
  })

  onCleanup(() => {
    events?.close()
    events = undefined
  })
}

export default createEventSourceEffect
