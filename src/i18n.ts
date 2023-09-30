import { Flatten, flatten, translator } from "@solid-primitives/i18n"
import { createAsyncMemo } from "@solid-primitives/memo"
import { createSignal } from "solid-js"
import type * as en from "./i18n/en"

export type RawDictionary = typeof en.dict
export type Dictionary = Flatten<RawDictionary>

const languageRegex = /i18n\/(\w+)/
export const languages = new Map(
  Object.entries(import.meta.glob("./i18n/*.ts", { import: "dict" }))
    .map(([file, load]) => {
      const locale = languageRegex.exec(file)![1]
      const loadDict = async (): Promise<Dictionary> => {
        const dictRaw = await load() as RawDictionary

        const dict = flatten(dictRaw)
        return dict
      }

      return [locale, loadDict] as const
    })
)

const [locale] = createSignal(navigator.language.slice(0, 2))
const dict = createAsyncMemo(async () => {
  const load = languages.get(locale()) ?? languages.get("en")!

  const dict = await load()
  return dict
})

export const t = translator(dict)
