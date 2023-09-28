use std::collections::HashMap;

mod fs;

#[tauri::command]
fn env_current_exe() -> Result<String, String> {
  return Ok(std::env::current_exe().map_err(|err| err.to_string())?.to_str().unwrap().to_owned());
}

#[tauri::command]
fn env_vars() -> Result<HashMap<String, String>, String> {
  let mut result = HashMap::new();

  for (key, value) in std::env::vars() {
    result.insert(key, value);
  }

  return Ok(result);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(fs::init())
    .invoke_handler(tauri::generate_handler![env_current_exe, env_vars])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
