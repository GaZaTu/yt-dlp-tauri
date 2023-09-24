import { Struct } from "superstruct"

const superstructIsRequired = (validator: Struct<any, any>, path = "") => {
  const struct = path.split(".")
    .reduce((s, p) => {
      if (!p) {
        return s
      }

      if (!isNaN(Number(p))) {
        return s.schema
      }

      return (s.schema as Record<string, any>)[p]
    }, validator)
  if (!struct) {
    return false
  }

  const nullable = (() => {
    try {
      struct.create(null)
      return true
    } catch {
      return false
    }
  })()

  const optional = (() => {
    try {
      struct.create(undefined)
      return true
    } catch {
      return false
    }
  })()

  const required = (!optional && !nullable)
  return required
}

export default superstructIsRequired
