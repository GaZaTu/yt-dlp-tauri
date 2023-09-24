// css
import "./index.scss"
// js
import App from "./App"

const ROOT_ELEMENT_ID = "root"

if (typeof window !== "undefined") {
  const main = () => <App />
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const root = document.getElementById(ROOT_ELEMENT_ID)!

  const { render } = await import("solid-js/web")
  render(main, root)

  if (typeof navigator.serviceWorker !== "undefined") {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      registration.unregister()
    }
  }
}
