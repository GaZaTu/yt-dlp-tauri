use tauri::{Runtime, plugin::{TauriPlugin, Builder}};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("fs")
    .invoke_handler(tauri::generate_handler![fs_read_dir, fs_create_dir, fs_remove_dir_all, fs_path_exists, fs_read_file, fs_write_file, fs_remove_file, fs_copy_file])
    .setup(|_app, _| {
      return Ok(());
    })
    .build()
}

#[tauri::command]
fn fs_read_dir(path: String) -> Result<Vec<String>, String> {
  let mut result: Vec<String> = Vec::new();

  let paths = std::fs::read_dir(path).map_err(|err| err.to_string())?;
  for path in paths {
    result.push(path.unwrap().path().into_os_string().into_string().unwrap());
  }

  return Ok(result);
}

#[tauri::command]
fn fs_create_dir(path: String) -> Result<(), String> {
  std::fs::create_dir(path).map_err(|err| err.to_string())?;

  return Ok(());
}

#[tauri::command]
fn fs_remove_dir_all(path: String) -> Result<(), String> {
  std::fs::remove_dir_all(path).map_err(|err| err.to_string())?;

  return Ok(());
}

#[tauri::command]
fn fs_path_exists(path: String) -> bool {
  return std::path::Path::new(&path).exists();
}

#[tauri::command]
async fn fs_read_file(path: String) -> Result<Vec<u8>, String> {
  return std::fs::read(path).map_err(|err| err.to_string());
}

#[tauri::command]
async fn fs_write_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
  return std::fs::write(path, bytes).map_err(|err| err.to_string());
}

#[tauri::command]
async fn fs_remove_file(path: String) -> Result<(), String> {
  return std::fs::remove_file(path).map_err(|err| err.to_string());
}

#[tauri::command]
async fn fs_copy_file(from: String, to: String) -> Result<(), String> {
  std::fs::copy(from, to).map_err(|err| err.to_string())?;

  return Ok(());
}
