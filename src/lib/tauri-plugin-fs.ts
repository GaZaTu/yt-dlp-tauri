import { invoke } from "@tauri-apps/api"

export const readDir = async (path: string) => {
  return await invoke<string[]>("plugin:fs|read_dir", { path })
}

export const createDir = async (path: string) => {
  return await invoke<void>("plugin:fs|create_dir", { path })
}

export const removeDirAll = async (path: string) => {
  return await invoke<void>("plugin:fs|remove_dir_all", { path })
}

export const pathExists = async (path: string) => {
  return await invoke<boolean>("plugin:fs|path_exists", { path })
}

export const readFile = async (path: string) => {
  const asArray = await invoke<number[]>("plugin:fs|read_file", { path })
  const asBytes = new Uint8Array(asArray)

  return asBytes
}

export const writeFile = async (path: string, bytes: Uint8Array | number[]) => {
  if (bytes instanceof Uint8Array) {
    bytes = [...bytes]
  }

  return await invoke<void>("plugin:fs|write_file", { path, bytes })
}

export const removeFile = async (path: string) => {
  return await invoke<void>("plugin:fs|remove_file", { path })
}
