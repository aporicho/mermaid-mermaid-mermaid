#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use std::{
    collections::{HashMap, VecDeque},
    fs,
    io,
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
};

use chrono::{Duration, Utc};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{Emitter, Manager, State};
use tiny_http::{Header, Method, Request, Response, StatusCode};
use uuid::Uuid;

#[derive(Clone, Default)]
struct BridgeState {
    inner: Arc<Mutex<BridgeInner>>,
}

#[derive(Default)]
struct BridgeInner {
    context: Option<Value>,
    commands: VecDeque<Value>,
    results: HashMap<String, Value>,
}

#[derive(Clone, Default)]
struct PendingOpenState {
    inner: Arc<Mutex<VecDeque<PendingOpenFile>>>,
}

#[derive(Serialize)]
struct OpenedFile {
    name: String,
    path: String,
    text: String,
}

#[derive(Serialize)]
struct SavedFile {
    name: String,
    path: String,
}

#[derive(Clone, Serialize)]
struct PendingOpenFile {
    name: String,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileCommandError {
    code: &'static str,
    message: String,
    path: Option<String>,
}

#[tauri::command]
async fn open_mermaid_file() -> Result<Option<OpenedFile>, FileCommandError> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Mermaid", &["mmd", "mermaid"])
        .pick_file()
        .await;

    let Some(file) = file else {
        return Ok(None);
    };

    let path = file.path().to_path_buf();
    open_mermaid_file_path_inner(path).await.map(Some)
}

#[tauri::command]
async fn open_mermaid_file_path(path: String) -> Result<OpenedFile, FileCommandError> {
    open_mermaid_file_path_inner(PathBuf::from(path)).await
}

#[tauri::command]
async fn save_mermaid_file(path: String, text: String) -> Result<SavedFile, FileCommandError> {
    let path = PathBuf::from(path);
    tokio::fs::write(&path, text)
        .await
        .map_err(|error| file_io_error("write_failed", &path, error))?;
    Ok(SavedFile {
        name: file_name(&path),
        path: path_to_string(&path),
    })
}

#[tauri::command]
async fn save_mermaid_file_as(suggested_name: String, text: String) -> Result<Option<SavedFile>, FileCommandError> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Mermaid", &["mmd", "mermaid"])
        .set_file_name(&suggested_name)
        .save_file()
        .await;

    let Some(file) = file else {
        return Ok(None);
    };

    let path = file.path().to_path_buf();
    tokio::fs::write(&path, text)
        .await
        .map_err(|error| file_io_error("write_failed", &path, error))?;
    Ok(Some(SavedFile {
        name: file_name(&path),
        path: path_to_string(&path),
    }))
}

#[tauri::command]
fn write_app_state(_app: tauri::AppHandle, state: Value) -> Result<(), String> {
    let path = app_data_dir()?.join("app-state.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(readable_error)?;
    }
    fs::write(path, serde_json::to_vec_pretty(&state).map_err(readable_error)?).map_err(readable_error)
}

#[tauri::command]
fn read_app_state() -> Result<Option<Value>, String> {
    let path = app_data_dir()?.join("app-state.json");
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(path).map_err(readable_error)?;
    serde_json::from_str(&text).map(Some).map_err(readable_error)
}

#[tauri::command]
fn take_pending_file_opens(state: State<'_, PendingOpenState>) -> Vec<PendingOpenFile> {
    state.take_all()
}

#[tauri::command]
fn publish_editor_context(state: State<'_, BridgeState>, context: Value) {
    state.set_context(context);
}

#[tauri::command]
fn take_next_ai_command(state: State<'_, BridgeState>) -> Value {
    json!({
        "ok": true,
        "command": state.take_next_command(),
        "diagnostics": []
    })
}

#[tauri::command]
fn finish_ai_command(state: State<'_, BridgeState>, result: Value) -> Result<(), String> {
    let command_id = result
        .get("commandId")
        .and_then(Value::as_str)
        .ok_or_else(|| "AI command result is missing commandId.".to_string())?;
    state.set_result(command_id.to_string(), result);
    Ok(())
}

impl BridgeState {
    fn set_context(&self, context: Value) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.context = Some(context);
        }
    }

    fn context_response(&self) -> Value {
        let Ok(inner) = self.inner.lock() else {
            return error_response("BRIDGE_LOCK_FAILED", "无法读取编辑器上下文。");
        };

        match &inner.context {
            Some(context) => json!({
                "ok": true,
                "context": context,
                "diagnostics": []
            }),
            None => json!({
                "ok": false,
                "diagnostics": [diagnostic("NO_ACTIVE_EDITOR_CONTEXT", "当前没有可用的编辑器上下文。", "请先打开桌面编辑器，并保持窗口处于运行状态。")]
            }),
        }
    }

    fn ping_response(&self, server: &str) -> Value {
        let Ok(inner) = self.inner.lock() else {
            return error_response("BRIDGE_LOCK_FAILED", "无法读取编辑器状态。");
        };

        let updated_at = inner
            .context
            .as_ref()
            .and_then(|context| context.get("updatedAt"))
            .and_then(Value::as_str);

        json!({
            "ok": true,
            "server": server,
            "editorContext": {
                "available": inner.context.is_some(),
                "stale": inner.context.is_none(),
                "updatedAt": updated_at
            },
            "diagnostics": []
        })
    }

    fn submit_command(&self, body: Value) -> Value {
        let now = Utc::now();
        let command = json!({
            "id": format!("cmd_{}", Uuid::new_v4()),
            "type": body.get("type").and_then(Value::as_str).unwrap_or("applyPatch"),
            "createdAt": now.to_rfc3339(),
            "expiresAt": (now + Duration::seconds(30)).to_rfc3339(),
            "targetFileName": body.get("targetFileName").cloned().unwrap_or(Value::Null),
            "ops": body.get("ops").cloned().unwrap_or_else(|| json!([])),
            "autoSave": body.get("autoSave").and_then(Value::as_bool).unwrap_or(true)
        });

        if let Ok(mut inner) = self.inner.lock() {
            inner.commands.push_back(command.clone());
        }

        json!({
            "ok": true,
            "command": command,
            "diagnostics": []
        })
    }

    fn take_next_command(&self) -> Option<Value> {
        let Ok(mut inner) = self.inner.lock() else {
            return None;
        };

        let now = Utc::now();
        inner.commands.retain(|command| {
            command
                .get("expiresAt")
                .and_then(Value::as_str)
                .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
                .map(|expires_at| expires_at.with_timezone(&Utc) > now)
                .unwrap_or(false)
        });

        inner.commands.pop_front()
    }

    fn result_response(&self, command_id: &str) -> Value {
        let Ok(inner) = self.inner.lock() else {
            return error_response("BRIDGE_LOCK_FAILED", "无法读取 AI 命令结果。");
        };

        match inner.results.get(command_id) {
            Some(result) => json!({
                "ok": result.get("applied").and_then(Value::as_bool).unwrap_or(false),
                "status": "complete",
                "result": result,
                "diagnostics": result.get("diagnostics").cloned().unwrap_or_else(|| json!([]))
            }),
            None => json!({
                "ok": true,
                "status": "pending",
                "diagnostics": []
            }),
        }
    }

    fn set_result(&self, command_id: String, result: Value) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.results.insert(command_id, result);
            while inner.results.len() > 40 {
                if let Some(key) = inner.results.keys().next().cloned() {
                    inner.results.remove(&key);
                }
            }
        }
    }
}

impl PendingOpenState {
    fn push_many(&self, files: Vec<PendingOpenFile>) -> Vec<PendingOpenFile> {
        if files.is_empty() {
            return files;
        }

        if let Ok(mut inner) = self.inner.lock() {
            for file in files.iter().cloned() {
                if !inner.iter().any(|item| item.path == file.path) {
                    inner.push_back(file);
                }
            }
        }

        files
    }

    fn take_all(&self) -> Vec<PendingOpenFile> {
        let Ok(mut inner) = self.inner.lock() else {
            return Vec::new();
        };
        inner.drain(..).collect()
    }
}

async fn open_mermaid_file_path_inner(path: PathBuf) -> Result<OpenedFile, FileCommandError> {
    if !is_supported_mermaid_path(&path) {
        return Err(file_workflow_error(
            "unsupported_type",
            "只支持 .mmd 或 .mermaid 文件。",
            Some(&path),
        ));
    }

    let text = tokio::fs::read_to_string(&path)
        .await
        .map_err(|error| file_io_error("read_failed", &path, error))?;
    Ok(OpenedFile {
        name: file_name(&path),
        path: path_to_string(&path),
        text,
    })
}

fn start_bridge(state: BridgeState, app_version: String) -> Result<(), String> {
    let token = Uuid::new_v4().to_string();
    let listener = TcpListener::bind("127.0.0.1:0").map_err(readable_error)?;
    let port = listener.local_addr().map_err(readable_error)?.port();
    let server = tiny_http::Server::from_listener(listener, None).map_err(readable_error)?;
    let server_url = format!("http://127.0.0.1:{port}");

    write_discovery(port, &token, &app_version)?;

    thread::spawn(move || {
        for request in server.incoming_requests() {
            handle_bridge_request(request, state.clone(), &token, &server_url);
        }
    });

    Ok(())
}

fn handle_bridge_request(mut request: Request, state: BridgeState, token: &str, server_url: &str) {
    let method = request.method().clone();
    let path = request.url().split('?').next().unwrap_or("").to_string();

    if !is_authorized(&request, token) {
        respond_json(
            request,
            StatusCode(401),
            json!({
                "ok": false,
                "diagnostics": [diagnostic("UNAUTHORIZED", "AI bridge token 无效。", "重新打开桌面应用后再执行 CLI 命令。")]
            }),
        );
        return;
    }

    let body = match (method, path.as_str()) {
        (Method::Get, "/api/ai/ping") => state.ping_response(server_url),
        (Method::Get, "/api/ai/context") => state.context_response(),
        (Method::Post, "/api/ai/commands") => state.submit_command(read_request_json(&mut request)),
        (Method::Get, path) if path.starts_with("/api/ai/commands/") => {
            let command_id = path.trim_start_matches("/api/ai/commands/");
            state.result_response(command_id)
        }
        (Method::Post, path) if path.starts_with("/api/ai/commands/") && path.ends_with("/result") => {
            let command_id = path
                .trim_start_matches("/api/ai/commands/")
                .trim_end_matches("/result")
                .trim_end_matches('/');
            state.set_result(command_id.to_string(), read_request_json(&mut request));
            json!({
                "ok": true,
                "diagnostics": []
            })
        }
        _ => json!({
            "ok": false,
            "diagnostics": [diagnostic("NOT_FOUND", "未知 AI bridge 路径。", Value::Null)]
        }),
    };

    respond_json(request, StatusCode(200), body);
}

fn read_request_json(request: &mut Request) -> Value {
    let mut body = String::new();
    if request.as_reader().read_to_string(&mut body).is_err() {
        return json!({});
    }
    serde_json::from_str(&body).unwrap_or_else(|_| json!({}))
}

fn is_authorized(request: &Request, token: &str) -> bool {
    request.headers().iter().any(|header| {
        header.field.equiv("authorization") && header.value.as_str() == format!("Bearer {token}")
    })
}

fn respond_json(request: Request, status: StatusCode, body: Value) {
    let header = Header::from_bytes(&b"content-type"[..], &b"application/json; charset=utf-8"[..])
        .expect("valid content-type header");
    let response = Response::from_string(body.to_string())
        .with_status_code(status)
        .with_header(header);
    let _ = request.respond(response);
}

fn write_discovery(port: u16, token: &str, app_version: &str) -> Result<(), String> {
    let path = discovery_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(readable_error)?;
    }

    let payload = json!({
        "port": port,
        "token": token,
        "pid": std::process::id(),
        "appVersion": app_version,
        "updatedAt": Utc::now().to_rfc3339()
    });

    fs::write(path, serde_json::to_vec_pretty(&payload).map_err(readable_error)?).map_err(readable_error)
}

fn discovery_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("bridge.json"))
}

fn app_data_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Cannot resolve home directory.".to_string())?;
    Ok(home.join(".mermaid-canvas-editor"))
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("diagram.mmd")
        .to_string()
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn is_supported_mermaid_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("mmd") || extension.eq_ignore_ascii_case("mermaid"))
        .unwrap_or(false)
}

fn collect_mermaid_file_args(args: impl IntoIterator<Item = String>) -> Vec<PendingOpenFile> {
    args.into_iter()
        .filter_map(|arg| {
            let path = PathBuf::from(arg);
            if is_supported_mermaid_path(&path) {
                Some(PendingOpenFile {
                    name: file_name(&path),
                    path: path_to_string(&path),
                })
            } else {
                None
            }
        })
        .collect()
}

fn emit_pending_file_opens<R: tauri::Runtime>(app: &tauri::AppHandle<R>, files: Vec<PendingOpenFile>) {
    if files.is_empty() {
        return;
    }

    let queued = app.state::<PendingOpenState>().push_many(files);
    let _ = app.emit("file-workflow:external-open", queued);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}

fn file_workflow_error(code: &'static str, message: impl Into<String>, path: Option<&Path>) -> FileCommandError {
    FileCommandError {
        code,
        message: message.into(),
        path: path.map(path_to_string),
    }
}

fn file_io_error(default_code: &'static str, path: &Path, error: io::Error) -> FileCommandError {
    let code = match error.kind() {
        io::ErrorKind::NotFound => "file_not_found",
        io::ErrorKind::PermissionDenied => "permission_denied",
        _ => default_code,
    };
    file_workflow_error(code, error.to_string(), Some(path))
}

fn diagnostic(code: &str, message: &str, suggestion: impl Into<Value>) -> Value {
    json!({
        "id": format!("bridge:{code}"),
        "severity": "error",
        "source": "serializer",
        "code": code,
        "message": message,
        "suggestion": suggestion.into()
    })
}

fn error_response(code: &str, message: &str) -> Value {
    json!({
        "ok": false,
        "diagnostics": [diagnostic(code, message, Value::Null)]
    })
}

fn readable_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let bridge_state = BridgeState::default();
    let bridge_for_setup = bridge_state.clone();
    let pending_open_state = PendingOpenState::default();

    tauri::Builder::default()
        .manage(bridge_state)
        .manage(pending_open_state)
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            emit_pending_file_opens(app, collect_mermaid_file_args(args));
        }))
        .setup(move |app| {
            let version = app.package_info().version.to_string();
            start_bridge(bridge_for_setup.clone(), version)
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            let startup_files = collect_mermaid_file_args(std::env::args().skip(1));
            app.state::<PendingOpenState>().push_many(startup_files);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_mermaid_file,
            open_mermaid_file_path,
            save_mermaid_file,
            save_mermaid_file_as,
            write_app_state,
            read_app_state,
            take_pending_file_opens,
            publish_editor_context,
            take_next_ai_command,
            finish_ai_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
