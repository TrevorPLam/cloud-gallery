use tauri::{AppHandle, Manager, CustomMenuItem, SystemTrayMenu, SystemTrayMenuItem, SystemTray, SystemTrayEvent, menu::Menu, Window};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_notification::NotificationExt;

pub struct DesktopFeaturesService {
    app_handle: AppHandle,
}

impl DesktopFeaturesService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub fn setup_system_tray(&self) -> Result<(), Box<dyn std::error::Error>> {
        let show = CustomMenuItem::new("show".to_string(), "Show Cloud Gallery");
        let hide = CustomMenuItem::new("hide".to_string(), "Hide");
        let sync = CustomMenuItem::new("sync".to_string(), "Sync Photos");
        let settings = CustomMenuItem::new("settings".to_string(), "Settings");
        let quit = CustomMenuItem::new("quit".to_string(), "Quit");

        let tray_menu = SystemTrayMenu::new()
            .add_item(show)
            .add_item(hide)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(sync)
            .add_item(settings)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(quit);

        let system_tray = SystemTray::new().with_menu(tray_menu);

        self.app_handle.system_tray(&system_tray);
        
        // Handle tray events
        self.app_handle.on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_webview_window("main").unwrap();
                let _ = window.show();
                let _ = window.set_focus();
            }
            SystemTrayEvent::MenuItemClick { id, .. } => {
                let window = app.get_webview_window("main").unwrap();
                match id.as_str() {
                    "show" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    "hide" => {
                        let _ = window.hide();
                    }
                    "sync" => {
                        // Trigger sync operation
                        let _ = window.emit("trigger-sync", ());
                    }
                    "settings" => {
                        let _ = window.emit("navigate-to", "settings");
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                }
            }
            _ => {}
        });

        Ok(())
    }

    pub fn setup_global_shortcuts(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Register global shortcuts
        self.app_handle.global_shortcut().register(
            Shortcut::new(Some(Code::KeyS), Some(vec![Code::ControlOrMeta])),
            move |app_handle| {
                let window = app_handle.get_webview_window("main").unwrap();
                let _ = window.emit("shortcut-save", ());
            }
        )?;

        self.app_handle.global_shortcut().register(
            Shortcut::new(Some(Code::Comma), Some(vec![Code::ControlOrMeta])),
            move |app_handle| {
                let window = app_handle.get_webview_window("main").unwrap();
                let _ = window.emit("shortcut-preferences", ());
            }
        )?;

        self.app_handle.global_shortcut().register(
            Shortcut::new(Some(Code::KeyO), Some(vec![Code::ControlOrMeta])),
            move |app_handle| {
                let window = app_handle.get_webview_window("main").unwrap();
                let _ = window.emit("shortcut-open", ());
            }
        )?;

        Ok(())
    }

    pub fn setup_drag_drop(&self, window: &Window) -> Result<(), Box<dyn std::error::Error>> {
        // Enable drag and drop on the window
        window.on_window_event(|window, event| {
            if let tauri::WindowEvent::FileDrop(file_drop_event) = event {
                if let Some(paths) = &file_drop_event.paths {
                    let _ = window.emit("files-dropped", &paths);
                    
                    // Show notification for dropped files
                    let notification = window.notification()
                        .title("Files Dropped")
                        .body(&format!("{} files dropped for import", paths.len()))
                        .show();
                    
                    if let Err(e) = notification {
                        eprintln!("Failed to show notification: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    pub fn show_file_dialog(&self, window: &Window, directory: bool) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let file_path = if directory {
            window.dialog().blocking_open_folder(Some("Select a folder to watch"))
        } else {
            window.dialog().blocking_open_file(Some("Select files"), Some(vec![
                ("Image Files", &["jpg", "jpeg", "png", "gif", "bmp", "tiff", "heic", "webp"]),
                ("All Files", &["*"])
            ]))
        };

        match file_path {
            Some(path) => Ok(vec![path.to_string_lossy().to_string()]),
            None => Ok(vec![]),
        }
    }

    pub fn show_notification(&self, title: &str, body: &str) -> Result<(), Box<dyn std::error::Error>> {
        let notification = self.app_handle.notification()
            .title(title)
            .body(body)
            .show();

        match notification {
            Ok(_) => Ok(()),
            Err(e) => Err(Box::new(e)),
        }
    }

    pub fn show_error_dialog(&self, message: &str) -> Result<(), Box<dyn std::error::Error>> {
        let window = self.app_handle.get_webview_window("main").unwrap();
        window.dialog().blocking_message(
            "Error",
            MessageDialogKind::Error,
            message
        );
        Ok(())
    }

    pub fn show_info_dialog(&self, title: &str, message: &str) -> Result<(), Box<dyn std::error::Error>> {
        let window = self.app_handle.get_webview_window("main").unwrap();
        window.dialog().blocking_message(
            title,
            MessageDialogKind::Info,
            message
        );
        Ok(())
    }

    pub fn minimize_to_tray(&self) -> Result<(), Box<dyn std::error::Error>> {
        let window = self.app_handle.get_webview_window("main").unwrap();
        let _ = window.hide();
        
        // Show notification that app is in tray
        self.show_notification(
            "Cloud Gallery",
            "Application minimized to system tray"
        )?;
        
        Ok(())
    }

    pub fn restore_from_tray(&self) -> Result<(), Box<dyn std::error::Error>> {
        let window = self.app_handle.get_webview_window("main").unwrap();
        let _ = window.show();
        let _ = window.set_focus();
        Ok(())
    }
}
