mod fs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(fs::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
