#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::{
    collections::{HashMap, VecDeque},
    fs,
    hash::{DefaultHasher, Hash, Hasher},
    io::{self, Read, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};

use chrono::{Duration, Utc};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{Emitter, Manager, State};
use tiny_http::{Header, Method, Request, Response, StatusCode};
use uuid::Uuid;

mod link_preview;
mod project_workspace;
use link_preview::resolve_link_preview;
use project_workspace::{scan_mermaid_project_folder, ProjectWorkspace};

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

#[derive(Clone, Default)]
struct TerminalState {
    inner: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageAssetFile {
    src: String,
    path: String,
    copied: bool,
}

#[derive(Clone, Serialize)]
struct PendingOpenFile {
    name: String,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalSessionInfo {
    session_id: String,
    cwd: String,
    shell_id: String,
    shell_label: String,
    shell: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalShellOption {
    id: String,
    label: String,
    command: String,
    available: bool,
}

#[derive(Clone)]
struct TerminalShellSpec {
    id: &'static str,
    label: &'static str,
    program: String,
    args: Vec<String>,
    available: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalDataEvent {
    session_id: String,
    data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitEvent {
    session_id: String,
    exit_code: Option<i32>,
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
        .add_filter("项目文档", &["mmd", "mermaid", "md", "markdown", "json"])
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
async fn open_mermaid_project_folder() -> Result<Option<ProjectWorkspace>, FileCommandError> {
    let folder = rfd::AsyncFileDialog::new().pick_folder().await;

    let Some(folder) = folder else {
        return Ok(None);
    };

    scan_mermaid_project_folder(folder.path().to_path_buf()).map(Some)
}

#[tauri::command]
fn read_mermaid_project_folder(root_path: String) -> Result<ProjectWorkspace, FileCommandError> {
    scan_mermaid_project_folder(PathBuf::from(root_path))
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
async fn save_mermaid_file_as(
    suggested_name: String,
    text: String,
) -> Result<Option<SavedFile>, FileCommandError> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("项目文档", &["mmd", "mermaid", "md", "markdown", "json"])
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
async fn pick_image_asset(
    document_path: String,
) -> Result<Option<ImageAssetFile>, FileCommandError> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Image", &["png", "jpg", "jpeg", "webp", "gif", "svg"])
        .pick_file()
        .await;

    let Some(file) = file else {
        return Ok(None);
    };

    import_image_asset_path_inner(PathBuf::from(document_path), file.path().to_path_buf())
        .await
        .map(Some)
}

#[tauri::command]
async fn import_image_asset_path(
    document_path: String,
    image_path: String,
) -> Result<ImageAssetFile, FileCommandError> {
    import_image_asset_path_inner(PathBuf::from(document_path), PathBuf::from(image_path)).await
}

#[tauri::command]
async fn import_image_asset_bytes(
    document_path: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<ImageAssetFile, FileCommandError> {
    import_image_asset_bytes_inner(PathBuf::from(document_path), file_name, bytes).await
}

#[tauri::command]
fn resolve_image_asset_path(
    document_path: String,
    src: String,
) -> Result<Option<String>, FileCommandError> {
    if is_external_asset_src(&src) {
        return Ok(None);
    }

    let document = PathBuf::from(document_path);
    let document_dir = document.parent().unwrap_or_else(|| Path::new("."));
    let candidate = PathBuf::from(&src);
    let path = if candidate.is_absolute() {
        candidate
    } else {
        document_dir.join(candidate)
    };

    if !is_supported_image_path(&path) {
        return Ok(None);
    }

    Ok(Some(path_to_string(&path)))
}

#[tauri::command]
fn write_app_state(_app: tauri::AppHandle, state: Value) -> Result<(), String> {
    let path = app_data_dir()?.join("app-state.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(readable_error)?;
    }
    fs::write(
        path,
        serde_json::to_vec_pretty(&state).map_err(readable_error)?,
    )
    .map_err(readable_error)
}

#[tauri::command]
fn read_app_state() -> Result<Option<Value>, String> {
    let path = app_data_dir()?.join("app-state.json");
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(path).map_err(readable_error)?;
    serde_json::from_str(&text)
        .map(Some)
        .map_err(readable_error)
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

#[tauri::command]
fn terminal_open(
    app: tauri::AppHandle,
    state: State<'_, TerminalState>,
    cwd: Option<String>,
    shell_id: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<TerminalSessionInfo, String> {
    let session_id = format!("term_{}", Uuid::new_v4());
    let cwd_path = resolve_terminal_cwd(cwd);
    let cwd_display = path_to_string(&cwd_path);
    let shell = resolve_terminal_shell(shell_id.as_deref())?;
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(terminal_size(cols, rows))
        .map_err(readable_error)?;
    let mut command = CommandBuilder::new(&shell.program);
    for arg in &shell.args {
        command.arg(arg.as_str());
    }
    command.cwd(&cwd_path);

    let mut child = pair.slave.spawn_command(command).map_err(readable_error)?;
    let killer = child.clone_killer();
    let mut reader = pair.master.try_clone_reader().map_err(readable_error)?;
    let writer = pair.master.take_writer().map_err(readable_error)?;

    let reader_session_id = session_id.clone();
    let reader_app = app.clone();
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ = reader_app.emit(
                        "terminal:data",
                        TerminalDataEvent {
                            session_id: reader_session_id.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    let wait_session_id = session_id.clone();
    let wait_app = app.clone();
    let wait_state = state.inner.clone();
    thread::spawn(move || {
        let exit_code = child.wait().ok().map(|status| status.exit_code() as i32);
        if let Ok(mut sessions) = wait_state.lock() {
            sessions.remove(&wait_session_id);
        }
        let _ = wait_app.emit(
            "terminal:exit",
            TerminalExitEvent {
                session_id: wait_session_id,
                exit_code,
            },
        );
    });

    let info = TerminalSessionInfo {
        session_id: session_id.clone(),
        cwd: cwd_display.clone(),
        shell_id: shell.id.to_string(),
        shell_label: shell.label.to_string(),
        shell: shell.command_label(),
    };

    state.insert(
        session_id,
        TerminalSession {
            master: pair.master,
            writer,
            killer,
        },
    )?;

    Ok(info)
}

#[tauri::command]
fn terminal_list_shells() -> Vec<TerminalShellOption> {
    terminal_shell_specs()
        .into_iter()
        .map(|shell| TerminalShellOption {
            id: shell.id.to_string(),
            label: shell.label.to_string(),
            command: shell.command_label(),
            available: shell.available,
        })
        .collect()
}

#[tauri::command]
fn terminal_write(
    state: State<'_, TerminalState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state.write(&session_id, data.as_bytes())
}

#[tauri::command]
fn terminal_resize(
    state: State<'_, TerminalState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&session_id, terminal_size(cols, rows))
}

#[tauri::command]
fn terminal_close(state: State<'_, TerminalState>, session_id: String) -> Result<(), String> {
    state.close(&session_id)
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

impl TerminalState {
    fn insert(&self, session_id: String, session: TerminalSession) -> Result<(), String> {
        let mut sessions = self
            .inner
            .lock()
            .map_err(|_| "无法保存终端会话。".to_string())?;
        sessions.insert(session_id, session);
        Ok(())
    }

    fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self
            .inner
            .lock()
            .map_err(|_| "无法访问终端会话。".to_string())?;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| "终端会话不存在。".to_string())?;
        session.writer.write_all(data).map_err(readable_error)?;
        session.writer.flush().map_err(readable_error)
    }

    fn resize(&self, session_id: &str, size: PtySize) -> Result<(), String> {
        let sessions = self
            .inner
            .lock()
            .map_err(|_| "无法访问终端会话。".to_string())?;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "终端会话不存在。".to_string())?;
        session.master.resize(size).map_err(readable_error)
    }

    fn close(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self
            .inner
            .lock()
            .map_err(|_| "无法访问终端会话。".to_string())?;
        let Some(mut session) = sessions.remove(session_id) else {
            return Ok(());
        };
        let _ = session.killer.kill();
        Ok(())
    }

    fn close_all(&self) {
        let Ok(mut sessions) = self.inner.lock() else {
            return;
        };
        for (_, mut session) in sessions.drain() {
            let _ = session.killer.kill();
        }
    }
}

async fn open_mermaid_file_path_inner(path: PathBuf) -> Result<OpenedFile, FileCommandError> {
    if !is_supported_document_path(&path) {
        return Err(file_workflow_error(
            "unsupported_type",
            "只支持 .mmd、.mermaid、.md、.markdown 或 .canvas.json 文件。",
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

async fn import_image_asset_path_inner(
    document_path: PathBuf,
    image_path: PathBuf,
) -> Result<ImageAssetFile, FileCommandError> {
    if !is_supported_image_document_path(&document_path) {
        return Err(file_workflow_error(
            "unsupported_type",
            "请先保存为 .mmd、.mermaid 或 .canvas.json 文件，再插入本地图片。",
            Some(&document_path),
        ));
    }
    if !is_supported_image_path(&image_path) {
        return Err(file_workflow_error(
            "unsupported_type",
            "只支持 png、jpg、jpeg、webp、gif 或 svg 图片。",
            Some(&image_path),
        ));
    }

    let document_dir = document_path.parent().unwrap_or_else(|| Path::new("."));
    let image_absolute = image_path
        .canonicalize()
        .map_err(|error| file_io_error("read_failed", &image_path, error))?;
    let document_absolute_dir = document_dir
        .canonicalize()
        .unwrap_or_else(|_| document_dir.to_path_buf());

    let (asset_path, copied) = if image_absolute.starts_with(&document_absolute_dir) {
        (image_absolute, false)
    } else {
        let destination_dir = document_dir
            .join("assets")
            .join(document_stem(&document_path));
        fs::create_dir_all(&destination_dir)
            .map_err(|error| file_io_error("write_failed", &destination_dir, error))?;
        let destination = destination_dir.join(copied_image_file_name(&image_absolute));
        tokio::fs::copy(&image_absolute, &destination)
            .await
            .map_err(|error| file_io_error("write_failed", &destination, error))?;
        (destination, true)
    };

    let src = relative_asset_src(document_dir, &asset_path);
    Ok(ImageAssetFile {
        src,
        path: path_to_string(&asset_path),
        copied,
    })
}

async fn import_image_asset_bytes_inner(
    document_path: PathBuf,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<ImageAssetFile, FileCommandError> {
    if !is_supported_image_document_path(&document_path) {
        return Err(file_workflow_error(
            "unsupported_type",
            "请先保存为 .mmd、.mermaid 或 .canvas.json 文件，再插入本地图片。",
            Some(&document_path),
        ));
    }
    let image_path = PathBuf::from(&file_name);
    if !is_supported_image_path(&image_path) {
        return Err(file_workflow_error(
            "unsupported_type",
            "只支持 png、jpg、jpeg、webp、gif 或 svg 图片。",
            Some(&image_path),
        ));
    }

    let document_dir = document_path.parent().unwrap_or_else(|| Path::new("."));
    let destination_dir = document_dir
        .join("assets")
        .join(document_stem(&document_path));
    fs::create_dir_all(&destination_dir)
        .map_err(|error| file_io_error("write_failed", &destination_dir, error))?;
    let destination = unique_asset_destination(&destination_dir, &image_path, &bytes);
    tokio::fs::write(&destination, bytes)
        .await
        .map_err(|error| file_io_error("write_failed", &destination, error))?;

    let src = relative_asset_src(document_dir, &destination);
    Ok(ImageAssetFile {
        src,
        path: path_to_string(&destination),
        copied: true,
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
        (Method::Post, path)
            if path.starts_with("/api/ai/commands/") && path.ends_with("/result") =>
        {
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
    let header = Header::from_bytes(
        &b"content-type"[..],
        &b"application/json; charset=utf-8"[..],
    )
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

    fs::write(
        path,
        serde_json::to_vec_pretty(&payload).map_err(readable_error)?,
    )
    .map_err(readable_error)
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

fn home_dir() -> PathBuf {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn resolve_terminal_cwd(cwd: Option<String>) -> PathBuf {
    cwd.map(PathBuf::from)
        .filter(|path| path.is_dir())
        .and_then(|path| path.canonicalize().ok())
        .unwrap_or_else(home_dir)
}

fn default_terminal_shell() -> String {
    if cfg!(windows) {
        return std::env::var("ComSpec").unwrap_or_else(|_| "powershell.exe".to_string());
    }

    std::env::var("SHELL").unwrap_or_else(|_| "sh".to_string())
}

impl TerminalShellSpec {
    fn command_label(&self) -> String {
        std::iter::once(self.program.as_str())
            .chain(self.args.iter().map(String::as_str))
            .collect::<Vec<_>>()
            .join(" ")
    }
}

fn terminal_shell_specs() -> Vec<TerminalShellSpec> {
    let default_program = default_terminal_shell();
    let mut shells = vec![TerminalShellSpec {
        id: "default",
        label: "默认",
        available: command_exists(&default_program),
        program: default_program,
        args: Vec::new(),
    }];

    if cfg!(windows) {
        shells.extend([
            shell_spec("powershell", "PowerShell", "powershell.exe", &["-NoLogo"]),
            shell_spec("pwsh", "PowerShell 7", "pwsh.exe", &["-NoLogo"]),
            shell_spec("cmd", "CMD", "cmd.exe", &[]),
            shell_spec("wsl", "WSL", "wsl.exe", &[]),
        ]);
    } else {
        shells.extend([
            shell_spec("bash", "Bash", "bash", &[]),
            shell_spec("zsh", "Zsh", "zsh", &[]),
            shell_spec("sh", "sh", "sh", &[]),
        ]);
    }

    shells
}

fn shell_spec(
    id: &'static str,
    label: &'static str,
    program: &str,
    args: &[&str],
) -> TerminalShellSpec {
    TerminalShellSpec {
        id,
        label,
        program: program.to_string(),
        args: args.iter().map(|arg| (*arg).to_string()).collect(),
        available: command_exists(program),
    }
}

fn resolve_terminal_shell(shell_id: Option<&str>) -> Result<TerminalShellSpec, String> {
    let shells = terminal_shell_specs();
    let requested = shell_id.unwrap_or("default");
    let shell = shells
        .iter()
        .find(|shell| shell.id == requested)
        .or_else(|| shells.iter().find(|shell| shell.id == "default"))
        .cloned()
        .ok_or_else(|| "没有可用终端 shell。".to_string())?;

    if !shell.available {
        return Err(format!("当前系统不可用 shell：{}", shell.label));
    }

    Ok(shell)
}

fn command_exists(program: &str) -> bool {
    let path = PathBuf::from(program);
    if path.is_absolute() || program.contains('/') || program.contains('\\') {
        return path.is_file();
    }

    if std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default())
        .any(|dir| dir.join(program).is_file())
    {
        return true;
    }

    if cfg!(windows) {
        return [
            format!(r"C:\Windows\System32\{program}"),
            format!(r"C:\Windows\SysWOW64\{program}"),
            format!(r"C:\Windows\System32\WindowsPowerShell\v1.0\{program}"),
        ]
        .iter()
        .any(|candidate| PathBuf::from(candidate).is_file());
    }

    ["/bin", "/usr/bin", "/usr/local/bin"]
        .iter()
        .any(|dir| Path::new(dir).join(program).is_file())
}

fn terminal_size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        cols: cols.clamp(20, 240),
        rows: rows.clamp(4, 80),
        pixel_width: 0,
        pixel_height: 0,
    }
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

fn unix_time_millis(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn is_supported_mermaid_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| {
            extension.eq_ignore_ascii_case("mmd") || extension.eq_ignore_ascii_case("mermaid")
        })
        .unwrap_or(false)
}

fn is_supported_canvas_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|name| name.to_ascii_lowercase().ends_with(".canvas.json"))
        .unwrap_or(false)
}

fn is_supported_image_document_path(path: &Path) -> bool {
    is_supported_mermaid_path(path) || is_supported_canvas_path(path)
}

fn is_supported_document_path(path: &Path) -> bool {
    if is_supported_canvas_path(path) {
        return true;
    }
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "mmd" | "mermaid" | "md" | "markdown"
            )
        })
        .unwrap_or(false)
}

fn is_supported_image_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg"
            )
        })
        .unwrap_or(false)
}

fn is_external_asset_src(src: &str) -> bool {
    let lower = src.to_ascii_lowercase();
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("data:")
        || lower.starts_with("blob:")
        || lower.starts_with("asset:")
        || lower.starts_with("tauri:")
}

fn document_stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("diagram")
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect()
}

fn copied_image_file_name(path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png");
    format!("{stem}-{}.{}", short_path_hash(path), extension)
}

fn unique_asset_destination(destination_dir: &Path, source_name: &Path, bytes: &[u8]) -> PathBuf {
    let stem = source_name
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let extension = source_name
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png");
    let mut hasher = DefaultHasher::new();
    source_name.hash(&mut hasher);
    bytes.len().hash(&mut hasher);
    bytes
        .iter()
        .take(4096)
        .for_each(|byte| byte.hash(&mut hasher));
    let hash = format!("{:x}", hasher.finish())
        .chars()
        .take(8)
        .collect::<String>();
    destination_dir.join(format!("{stem}-{hash}.{extension}"))
}

fn short_path_hash(path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    if let Ok(metadata) = fs::metadata(path) {
        metadata.len().hash(&mut hasher);
        if let Ok(modified) = metadata.modified() {
            modified.hash(&mut hasher);
        }
    }
    format!("{:x}", hasher.finish()).chars().take(8).collect()
}

fn relative_asset_src(base_dir: &Path, asset_path: &Path) -> String {
    asset_path
        .strip_prefix(base_dir)
        .map(path_to_string)
        .unwrap_or_else(|_| path_to_string(asset_path))
        .replace('\\', "/")
}

fn collect_mermaid_file_args(args: impl IntoIterator<Item = String>) -> Vec<PendingOpenFile> {
    args.into_iter()
        .filter_map(|arg| {
            let path = PathBuf::from(arg);
            if is_supported_document_path(&path) {
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

fn emit_pending_file_opens<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    files: Vec<PendingOpenFile>,
) {
    if files.is_empty() {
        return;
    }

    let queued = app.state::<PendingOpenState>().push_many(files);
    let _ = app.emit("file-workflow:external-open", queued);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}

fn file_workflow_error(
    code: &'static str,
    message: impl Into<String>,
    path: Option<&Path>,
) -> FileCommandError {
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
    let terminal_state = TerminalState::default();
    let terminal_for_window = terminal_state.clone();

    tauri::Builder::default()
        .manage(bridge_state)
        .manage(pending_open_state)
        .manage(terminal_state)
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            emit_pending_file_opens(app, collect_mermaid_file_args(args));
        }))
        .on_window_event(move |_window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                terminal_for_window.close_all();
            }
        })
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
            open_mermaid_project_folder,
            read_mermaid_project_folder,
            save_mermaid_file,
            save_mermaid_file_as,
            pick_image_asset,
            import_image_asset_path,
            import_image_asset_bytes,
            resolve_image_asset_path,
            resolve_link_preview,
            write_app_state,
            read_app_state,
            take_pending_file_opens,
            publish_editor_context,
            take_next_ai_command,
            finish_ai_command,
            terminal_list_shells,
            terminal_open,
            terminal_write,
            terminal_resize,
            terminal_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
