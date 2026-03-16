// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, State};
use std::sync::Mutex;
use std::collections::HashMap;
use file_watcher::FileChangeEvent;

mod file_watcher;
mod desktop_features;
use file_watcher::FileWatcherService;
use desktop_features::DesktopFeaturesService;

// Global state for file watchers
type FileWatchers = Mutex<HashMap<String, notify::RecommendedWatcher>>;

#[derive(Default)]
pub struct AppState {
    pub file_watchers: FileWatchers,
}

#[tauri::command]
async fn start_file_watch(
    path: String,
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut watchers = state.file_watchers.lock().unwrap();
    
    if watchers.contains_key(&path) {
        return Ok(());
    }

    let watcher = FileWatcherService::create(path.clone(), window)
        .await
        .map_err(|e| e.to_string())?;
    
    watchers.insert(path, watcher);
    Ok(())
}

#[tauri::command]
async fn stop_file_watch(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut watchers = state.file_watchers.lock().unwrap();
    watchers.remove(&path);
    Ok(())
}

#[tauri::command]
async fn get_supported_extensions() -> Vec<String> {
    let service = FileWatcherService::new();
    service.supported_extensions
}

#[tauri::command]
async fn show_file_dialog(
    window: tauri::Window,
    directory: bool,
) -> Result<Vec<String>, String> {
    let app_handle = window.app_handle();
    let desktop_features = DesktopFeaturesService::new(app_handle);
    
    desktop_features.show_file_dialog(&window, directory)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn show_notification(
    app_handle: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    let desktop_features = DesktopFeaturesService::new(app_handle);
    
    desktop_features.show_notification(&title, &body)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn minimize_to_tray(
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let desktop_features = DesktopFeaturesService::new(app_handle);
    
    desktop_features.minimize_to_tray()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn restore_from_tray(
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let desktop_features = DesktopFeaturesService::new(app_handle);
    
    desktop_features.restore_from_tray()
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            start_file_watch,
            stop_file_watch,
            get_supported_extensions,
            show_file_dialog,
            show_notification,
            minimize_to_tray,
            restore_from_tray
        ])
        .setup(|app| {
            let desktop_features = DesktopFeaturesService::new(app.handle().clone());
            desktop_features.setup_system_tray()?;
            desktop_features.setup_global_shortcuts()?;
            
            // Setup drag and drop for the main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = desktop_features.setup_drag_drop(&window);
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
