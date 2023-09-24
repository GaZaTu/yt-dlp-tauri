interface ResultMap {
  readAsText: string
  readAsArrayBuffer: ArrayBuffer
  readAsBinaryString: string
  readAsDataURL: string
}

interface ReadFileOpts<How extends keyof ResultMap> {
  how: How
  encoding?: string
  onprogress?: FileReader["onprogress"]
}

const readFile = <How extends keyof ResultMap = "readAsText">(file: File | Blob, { how, encoding, onprogress }: ReadFileOpts<How> = { how: "readAsText" as any }) => {
  return new Promise<ResultMap[How]>((resolve, reject) => {
    const fr = new FileReader()

    fr.onload = () => resolve(fr.result as any)
    fr.onerror = () => reject(fr.error)
    fr.onprogress = onprogress ?? null

    fr[how](file, encoding)
  })
}

export default readFile
