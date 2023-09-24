import { Component } from "solid-js"
import { Navbar } from "@gazatu/solid-spectre/ui/Navbar"
import { Section } from "@gazatu/solid-spectre/ui/Section"

// type AppFooterConfig = {
//   position?: JSX.CSSProperties["position"]
//   left?: JSX.Element
//   right?: JSX.Element
// }

// const [appFooterConfig, setAppFooterConfig] = createStore<AppFooterConfig>({})
// const useAppFooter = (config: typeof appFooterConfig) => {
//   createEffect(() => {
//     setAppFooterConfig(config)
//   })

//   onCleanup(() => {
//     setAppFooterConfig({})
//   })
// }

// export {
//   appFooterConfig,
//   setAppFooterConfig,
//   useAppFooter,
// }

const AppFooter: Component = () => {
  return (
    <Navbar.AsFooter id="AppFooter">
      <Section size="xl">
        <Navbar.Section />
        <Navbar.Section />
      </Section>
    </Navbar.AsFooter>
  )
}

export default AppFooter
