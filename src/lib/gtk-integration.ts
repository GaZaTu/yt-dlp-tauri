import { configDir, dataDir, homeDir } from "@tauri-apps/api/path"
import { readTextFile } from "./tauri-plugin-fs"

type GTKSettings = {
  "gtk-application-prefer-dark-theme": boolean
  "gtk-button-images"?: boolean
  "gtk-cursor-theme-name": string
  "gtk-cursor-theme-size": number
  "gtk-decoration-layout": string // icon:minimize,maximize,close
  "gtk-enable-animations": boolean
  "gtk-font-name": [string, number] // Noto Sans,  10
  "gtk-icon-theme-name": string
  "gtk-theme-name"?: string
}

const parseGTKSettingsINI = (ini: string): GTKSettings => {
  const result = {} as Record<any, any>

  const regex = /^(.+)=(.+)$/gm

  let match
  while ((match = regex.exec(ini)) !== null) {
    const [, key, value] = match
    result[key] = value

    if (!isNaN(Number(value))) {
      result[key] = Number(value)
      continue
    }

    switch (value) {
      case "true":
        result[key] = true
        break
      case "false":
        result[key] = false
        break
    }
  }

  result["gtk-font-name"] = result["gtk-font-name"].split(",")
    .map((p: string, i: number) => i === 0 ? p : Number(p.trim()))

  return result as GTKSettings
}

type GTKColors = {
  "borders": string
  "content_view_bg": string
  "error_color_backdrop": string
  "error_color": string
  "error_color_insensitive_backdrop": string
  "error_color_insensitive": string
  "insensitive_base_color": string
  "insensitive_base_fg_color": string
  "insensitive_bg_color": string
  "insensitive_borders": string
  "insensitive_fg_color": string
  "insensitive_selected_bg_color": string
  "insensitive_selected_fg_color": string
  "insensitive_unfocused_bg_color": string
  "insensitive_unfocused_fg_color": string
  "insensitive_unfocused_selected_bg_color": string
  "insensitive_unfocused_selected_fg_color": string
  "link_color": string
  "link_visited_color": string
  "success_color_backdrop": string
  "success_color": string
  "success_color_insensitive_backdrop": string
  "success_color_insensitive": string
  "theme_base_color": string
  "theme_bg_color": string
  "theme_button_background_backdrop": string
  "theme_button_background_backdrop_insensitive": string
  "theme_button_background_insensitive": string
  "theme_button_background_normal": string
  "theme_button_decoration_focus_backdrop": string
  "theme_button_decoration_focus_backdrop_insensitive": string
  "theme_button_decoration_focus": string
  "theme_button_decoration_focus_insensitive": string
  "theme_button_decoration_hover_backdrop": string
  "theme_button_decoration_hover_backdrop_insensitive": string
  "theme_button_decoration_hover": string
  "theme_button_decoration_hover_insensitive": string
  "theme_button_foreground_active_backdrop": string
  "theme_button_foreground_active_backdrop_insensitive": string
  "theme_button_foreground_active": string
  "theme_button_foreground_active_insensitive": string
  "theme_button_foreground_backdrop": string
  "theme_button_foreground_backdrop_insensitive": string
  "theme_button_foreground_insensitive": string
  "theme_button_foreground_normal": string
  "theme_fg_color": string
  "theme_header_background_backdrop": string
  "theme_header_background": string
  "theme_header_background_light": string
  "theme_header_foreground_backdrop": string
  "theme_header_foreground": string
  "theme_header_foreground_insensitive_backdrop": string
  "theme_header_foreground_insensitive": string
  "theme_hovering_selected_bg_color": string
  "theme_selected_bg_color": string
  "theme_selected_fg_color": string
  "theme_text_color": string
  "theme_titlebar_background_backdrop": string
  "theme_titlebar_background": string
  "theme_titlebar_background_light": string
  "theme_titlebar_foreground_backdrop": string
  "theme_titlebar_foreground": string
  "theme_titlebar_foreground_insensitive_backdrop": string
  "theme_titlebar_foreground_insensitive": string
  "theme_unfocused_base_color": string
  "theme_unfocused_bg_color": string
  "theme_unfocused_fg_color": string
  "theme_unfocused_selected_bg_color_alt": string
  "theme_unfocused_selected_bg_color": string
  "theme_unfocused_selected_fg_color": string
  "theme_unfocused_text_color": string
  "theme_unfocused_view_bg_color": string
  "theme_unfocused_view_text_color": string
  "theme_view_active_decoration_color": string
  "theme_view_hover_decoration_color": string
  "tooltip_background": string
  "tooltip_border": string
  "tooltip_text": string
  "unfocused_borders": string
  "unfocused_insensitive_borders": string
  "warning_color_backdrop": string
  "warning_color": string
  "warning_color_insensitive_backdrop": string
  "warning_color_insensitive": string
}

const parseGTKColorsCSS = (css: string, theme: string): GTKColors => {
  const result = {} as Record<any, any>

  // const regex = /^@define-color\s+(\S+)\s+(\S+);$/gm
  const regex = new RegExp(`^@define-color\\s+(\\S+)_${theme.toLowerCase()}\\s+(\\S+);$`, "gm")

  let match
  while ((match = regex.exec(css)) !== null) {
    const [, key, value] = match
    result[key] = value
  }

  return result as GTKColors
}

export const readGTKSettingsINI = async (version = "3.0") => {
  try {
    const ini = await readTextFile(`${await configDir()}/gtk-${version}/settings.ini`)

    const settings = parseGTKSettingsINI(ini)
    return settings
  } catch {
    return undefined
  }
}

export const readGTKColorsCSS = async (version = "3.0", settings?: GTKSettings) => {
  if (!settings) {
    settings = await readGTKSettingsINI(version)
  }
  if (!settings) {
    return undefined
  }

  const theme = settings?.["gtk-theme-name"]?.toLowerCase()
  const paths = [
    `${await configDir()}/gtk-${version}/colors.css`,
    `${await dataDir()}/themes/${theme}/gtk-${version}/colors.css`,
    `${await homeDir()}/.themes/${theme}/gtk-${version}/colors.css`,
    // `$XDG_DATA_DIRS/themes/$THEME/gtk-$VERSION/colors.css`,
    // `$DATADIR/share/themes/$THEME/gtk-$VERSION/colors.css`,
  ]

  for (const path of paths) {
    try {
      const css = await readTextFile(path)

      const colors = parseGTKColorsCSS(css, theme ?? "")
      return colors
    } catch {
      // ignore
    }
  }

  return undefined
}
