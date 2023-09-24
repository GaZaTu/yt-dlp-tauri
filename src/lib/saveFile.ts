const saveFile = (file: Blob, name: string) => {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.style.display = "none"

  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    document.body.removeChild(anchor)
  }
}

export default saveFile
