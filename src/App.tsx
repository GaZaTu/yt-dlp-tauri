import { AnchorContext } from "@gazatu/solid-spectre/ui/A.Context"
import { Icon } from "@gazatu/solid-spectre/ui/Icon"
import { ModalPortal } from "@gazatu/solid-spectre/ui/Modal.Portal"
import { Toaster } from "@gazatu/solid-spectre/ui/Toaster"
import { FeatherIconProvider } from "@gazatu/solid-spectre/util/FeatherIconProvider"
import { useColorSchemeEffect } from "@gazatu/solid-spectre/util/colorScheme"
import { MetaProvider, Title } from "@solidjs/meta"
import { Router, useLocation, useNavigate } from "@solidjs/router"
import { Component, ComponentProps, ErrorBoundary } from "solid-js"
import AppFooter from "./AppFooter"
import AppHeader from "./AppHeader"
import AppMain from "./AppMain"
import "./i18n"

Icon.registerProvider(FeatherIconProvider)

AnchorContext.useLocation = useLocation
AnchorContext.useNavigate = useNavigate

type Props = {
  url?: string
  head?: ComponentProps<typeof MetaProvider>["tags"]
}

const App: Component<Props> = props => {
  useColorSchemeEffect()

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
