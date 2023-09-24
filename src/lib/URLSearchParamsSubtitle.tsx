import { Component, Show } from "solid-js"

export const vscodeDarkPlus = {
  keyword: "#75c0ff", // "#569cd6",
  number: "#b5cea8",
  string: "#ce915b",
  symbol: "#d4d4d4",
  variable: "#4fc1ff",
}

const vscodeDarkPlusGetColorByString = (str: string, isCode = false) => {
  if (isCode) {
    if (["?", "&", "="].includes(str)) {
      return vscodeDarkPlus.symbol
    }

    return vscodeDarkPlus.variable
  } else {
    if (["null", "undefined", "true", "false"].includes(str)) {
      return vscodeDarkPlus.keyword
    }

    if (!isNaN(Number(str))) {
      return vscodeDarkPlus.number
    }

    return vscodeDarkPlus.string
  }
}

export const VSCodeDarkPlusCode: Component<{ children: string }> = props => {
  return (
    <span style={{ color: vscodeDarkPlusGetColorByString(props.children, true) }}>{props.children}</span>
  )
}

export const VSCodeDarkPlusValue: Component<{ children: string }> = props => {
  return (
    <i style={{ color: vscodeDarkPlusGetColorByString(props.children, false) }}>{props.children}</i>
  )
}

const URLSearchParamsSubtitle: Component<{ search?: string }> = props => {
  return (
    <Show when={props.search}>
      <h2>
        {props.search?.split("&")
          .map(pair => pair.split("="))
          .map(([key, value], i) => (
            <>
              <VSCodeDarkPlusCode>{i ? "&" : "?"}</VSCodeDarkPlusCode>
              <VSCodeDarkPlusCode>{key}</VSCodeDarkPlusCode>
              <VSCodeDarkPlusCode>{"="}</VSCodeDarkPlusCode>
              <VSCodeDarkPlusValue>{value}</VSCodeDarkPlusValue>
            </>
          ))
        }
      </h2>
    </Show>
  )
}

export default URLSearchParamsSubtitle
