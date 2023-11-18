import { invoke } from "@tauri-apps/api"

/**
 * plugin:fs|fs_read_dir
 */
export const readDir = async (path: string) => {
  return await invoke<string[]>("plugin:fs|fs_read_dir", { path })
}

/**
 * plugin:fs|fs_create_dir
 */
export const createDir = async (path: string) => {
  return await invoke<void>("plugin:fs|fs_create_dir", { path })
}

/**
 * plugin:fs|fs_remove_dir_all
 */
export const removeDirAll = async (path: string) => {
  return await invoke<void>("plugin:fs|fs_remove_dir_all", { path })
}

/**
 * plugin:fs|fs_path_exists
 */
export const pathExists = async (path: string) => {
  return await invoke<boolean>("plugin:fs|fs_path_exists", { path })
}

/**
 * plugin:fs|fs_read_file
 */
export const readFile = async (path: string) => {
  const asArray = await invoke<number[]>("plugin:fs|fs_read_file", { path })
  const asBytes = new Uint8Array(asArray)

  return asBytes
}

/**
 * plugin:fs|fs_read_file
 */
export const readTextFile = (path: string) => {
  return readFile(path)
    .then(b => new TextDecoder().decode(b))
}

/**
 * plugin:fs|fs_write_file
 */
export const writeFile = async (path: string, bytes: Uint8Array | number[]) => {
  if (bytes instanceof Uint8Array) {
    bytes = [...bytes]
  }

  return await invoke<void>("plugin:fs|fs_write_file", { path, bytes })
}

/**
 * plugin:fs|fs_write_file
 */
export const writeTextFile = (path: string, text: string) => {
  return writeFile(path, new TextEncoder().encode(text))
}

/**
 * plugin:fs|fs_remove_file
 */
export const removeFile = async (path: string) => {
  return await invoke<void>("plugin:fs|fs_remove_file", { path })
}

export const copyFile = async (from: string, to: string) => {
  return await invoke<void>("plugin:fs|fs_copy_file", { from, to })
}
