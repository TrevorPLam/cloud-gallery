use notify::{RecommendedWatcher, RecursiveMode, Watcher, Event, EventKind};
use tauri::Window;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct FileChangeEvent {
    pub path: String,
    pub event_type: String,
    pub timestamp: u64,
}

pub struct FileWatcherService {
    pub debounce_duration: Duration,
    pub supported_extensions: Vec<String>,
}

impl FileWatcherService {
    pub fn new() -> Self {
        Self {
            debounce_duration: Duration::from_millis(500),
            supported_extensions: vec![
                "jpg".to_string(), "jpeg".to_string(), "png".to_string(),
                "gif".to_string(), "bmp".to_string(), "tiff".to_string(),
                "heic".to_string(), "heif".to_string(), "webp".to_string(),
                "raw".to_string(), "dng".to_string(), "cr2".to_string(),
                "nef".to_string(), "arw".to_string(), "orf".to_string(),
                "rw2".to_string(), "pef".to_string(), "srw".to_string(),
            ],
        }
    }

    pub async fn create(
        path: String,
        window: Window,
    ) -> Result<RecommendedWatcher, Box<dyn std::error::Error>> {
        let service = Self::new();
        service.create_watcher(path, window).await
    }

    async fn create_watcher(
        &self,
        path: String,
        window: Window,
    ) -> Result<RecommendedWatcher, Box<dyn std::error::Error>> {
        let (tx, mut rx) = mpsc::channel(1000);
        let debounce_map = Arc::new(std::sync::Mutex::new(HashMap::<PathBuf, Instant>::new()));
        let supported_exts = self.supported_extensions.clone();
        let debounce_duration = self.debounce_duration;
        
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    let _ = tx.blocking_send(event);
                }
                Err(e) => println!("watch error: {:?}", e),
            }
        })?;

        // Start watching the directory
        watcher.watch(Path::new(&path), RecursiveMode::Recursive)?;

        // Handle events in background task with debouncing and filtering
        let window_clone = window.clone();
        let debounce_map_clone = debounce_map.clone();
        let supported_exts_clone = supported_exts.clone();
        
        tokio::spawn(async move {
            let mut event_buffer = HashMap::<PathBuf, FileChangeEvent>::new();
            
            while let Some(event) = rx.recv().await {
                if let Some(filtered_event) = Self::filter_and_process_event(
                    event, 
                    &supported_exts_clone
                ) {
                    let path = PathBuf::from(&filtered_event.path);
                    let now = Instant::now();
                    
                    // Check debounce
                    {
                        let mut map = debounce_map_clone.lock().unwrap();
                        if let Some(last_time) = map.get(&path) {
                            if now.duration_since(*last_time) < debounce_duration {
                                event_buffer.insert(path, filtered_event);
                                continue;
                            }
                        }
                        map.insert(path.clone(), now);
                    }
                    
                    // Send the event
                    Self::send_file_event(&window_clone, filtered_event).await;
                    
                    // Process buffered events for this path
                    if let Some(buffered_event) = event_buffer.remove(&path) {
                        tokio::time::sleep(debounce_duration).await;
                        Self::send_file_event(&window_clone, buffered_event).await;
                    }
                }
            }
        });

        Ok(watcher)
    }

    fn filter_and_process_event(
        event: Event, 
        supported_extensions: &[String]
    ) -> Option<FileChangeEvent> {
        // Filter out non-file events
        if event.kind.is_sync() || event.kind.is_other() {
            return None;
        }

        // Get the primary path
        let path = event.paths.first()?;
        
        // Check if it's a file (not directory)
        if !path.is_file() {
            return None;
        }

        // Check file extension
        if let Some(extension) = path.extension() {
            if let Some(ext_str) = extension.to_str() {
                if !supported_extensions.contains(&ext_str.to_lowercase()) {
                    return None;
                }
            } else {
                return None;
            }
        } else {
            return None;
        }

        // Determine event type
        let event_type = match event.kind {
            EventKind::Create(_) => "created".to_string(),
            EventKind::Modify(_) => "modified".to_string(),
            EventKind::Remove(_) => "removed".to_string(),
            _ => return None,
        };

        Some(FileChangeEvent {
            path: path.to_string_lossy().to_string(),
            event_type,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        })
    }

    async fn send_file_event(window: &Window, event: FileChangeEvent) {
        let _ = window.emit("file-change", &event);
    }
}
