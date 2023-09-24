import { Component, createEffect, createSignal, onCleanup } from "solid-js"
import { iconMoon } from "@gazatu/solid-spectre/icons/iconMoon"
import { iconSun } from "@gazatu/solid-spectre/icons/iconSun"
import { A } from "@gazatu/solid-spectre/ui/A"
import { CheckboxButton } from "@gazatu/solid-spectre/ui/CheckboxButton"
import { Column } from "@gazatu/solid-spectre/ui/Column"
import { Icon } from "@gazatu/solid-spectre/ui/Icon"
import { Navbar } from "@gazatu/solid-spectre/ui/Navbar"
import { GlobalProgress } from "@gazatu/solid-spectre/ui/Progress.Global"
import { Section } from "@gazatu/solid-spectre/ui/Section"
import { computedColorScheme, setColorScheme } from "@gazatu/solid-spectre/util/colorScheme"
import { centerChildren } from "@gazatu/solid-spectre/util/position"
import { tooltip } from "@gazatu/solid-spectre/util/tooltip"

const [showAppHeader, setShowAppHeader] = createSignal(false)
const useShowAppHeaderEffect = (show: boolean) => {
  createEffect(() => {
    setShowAppHeader(show)
  })

  onCleanup(() => {
    setShowAppHeader(false)
  })
}

const [appHeaderElement, setAppHeaderElement] = createSignal<HTMLElement>()

export {
  showAppHeader,
  setShowAppHeader,
  useShowAppHeaderEffect,
  appHeaderElement,
}

const AppHeader: Component = () => {
  const [expanded, setExpanded] = createSignal(false)

  return (
    <>
      <GlobalProgress />
      <Navbar id="AppHeader" size="lg" filled style={{ display: !showAppHeader() ? "none" : "flex" }} responsive expanded={expanded()} ref={setAppHeaderElement}>
        <Section size="xl">
          <Navbar.Section>
            <Navbar.Brand>
              <A href="/" />

              <Navbar.Burger expanded={expanded()} onclick={() => setExpanded(v => !v)} aria-label="toggle navigation" />
            </Navbar.Brand>
          </Navbar.Section>

          <Navbar.Section>
            <Column.Row gaps="sm">
              <Column class={`${centerChildren(true)}`}>
                <CheckboxButton checked={computedColorScheme() === "dark"} onclick={() => setColorScheme((computedColorScheme() === "dark") ? "light" : "dark")} {...tooltip("toggle color scheme", "bottom")} color="gray" action circle={false}
                  ifTrue={<Icon src={iconSun} />}
                  ifFalse={<Icon src={iconMoon} />}
                />
              </Column>
            </Column.Row>
          </Navbar.Section>
        </Section>
      </Navbar>
    </>
  )
}

export default AppHeader
