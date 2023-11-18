import { AnchorContext } from "@gazatu/solid-spectre/ui/A.Context"
import { Icon } from "@gazatu/solid-spectre/ui/Icon"
import { ModalPortal } from "@gazatu/solid-spectre/ui/Modal.Portal"
import { Toaster } from "@gazatu/solid-spectre/ui/Toaster"
import { FeatherIconProvider } from "@gazatu/solid-spectre/util/FeatherIconProvider"
import { useColorSchemeEffect } from "@gazatu/solid-spectre/util/colorScheme"
import { MetaProvider, Title } from "@solidjs/meta"
import { Router, useLocation, useNavigate } from "@solidjs/router"
import { Component, ComponentProps, ErrorBoundary, createEffect } from "solid-js"
import AppFooter from "./AppFooter"
import AppHeader from "./AppHeader"
import AppMain from "./AppMain"
import "./i18n"
import { readGTKColorsCSS } from "./lib/gtk-integration"

Icon.registerProvider(FeatherIconProvider)

AnchorContext.useLocation = useLocation
AnchorContext.useNavigate = useNavigate

type Props = {
  url?: string
  head?: ComponentProps<typeof MetaProvider>["tags"]
}

const App: Component<Props> = props => {
  useColorSchemeEffect()

  createEffect(async () => {
    const colorHexAsRgb = (hex: string) => {
      return [
        parseInt(hex.substr(1, 2), 16),
        parseInt(hex.substr(3, 2), 16),
        parseInt(hex.substr(5, 2), 16),
      ] as const
    }

    const colors = await readGTKColorsCSS()
    if (!colors) {
      return
    }

    const setColor = (cssVar: string, gtkVar: keyof typeof colors) => {
      document.documentElement.style.setProperty(`${cssVar}--rgb-triplet`, colorHexAsRgb(colors[gtkVar]).join(","))
      document.documentElement.style.setProperty(`${cssVar}`, `rgb(var(${cssVar}--rgb-triplet))`)
    }

    setColor("--body-bg", "theme_bg_color")
    setColor("--primary", "theme_selected_bg_color")
    setColor("--primary-monochrome", "theme_button_decoration_focus")
    setColor("--form-input-background", "theme_base_color")
    setColor("--btn-background", "theme_button_background_normal")
  })

  return (
    <Router url={props.url}>
      <MetaProvider tags={props.head}>
        <Title>gazatu.xyz</Title>
        {/* <Meta name="description">trivia'n'shit</Meta> */}

        <AppHeader />

        <ErrorBoundary fallback={Toaster.pushError}>
          <AppMain />
        </ErrorBoundary>

        <AppFooter />

        <ModalPortal />
        <Toaster />
      </MetaProvider>
    </Router>
  )
}

export default App
