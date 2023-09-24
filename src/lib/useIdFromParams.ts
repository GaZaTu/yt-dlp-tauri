import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"

const useIdFromParams = (props?: Record<string, any>, paramKey = "id", ifIsNew = "" as string | null) => {
  const params = useParams()
  const id = createMemo(() => {
    const idRaw = props?.[paramKey] ?? params[paramKey]
    const idResult = idRaw === "new" ? ifIsNew : idRaw

    return idResult
  })

  return id
}

export default useIdFromParams
