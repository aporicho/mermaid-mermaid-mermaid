use std::{
    fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

use serde::Serialize;

use crate::{
    file_io_error, file_name, is_supported_document_path, path_to_string, unix_time_millis,
    FileCommandError,
};

const PROJECT_FILE_LIMIT: usize = 500;
const PROJECT_RESOURCE_LIMIT: usize = 10_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectFileEntry {
    name: String,
    path: String,
    relative_path: String,
    modified_at: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectResourceEntry {
    kind: String,
    name: String,
    path: String,
    relative_path: String,
    modified_at: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectWorkspace {
    root_name: String,
    root_path: String,
    files: Vec<ProjectFileEntry>,
    resources: Vec<ProjectResourceEntry>,
    scanned_at: u64,
    truncated: bool,
    resources_truncated: bool,
}

pub(crate) fn scan_mermaid_project_folder(
    root: PathBuf,
) -> Result<ProjectWorkspace, FileCommandError> {
    let root = root
        .canonicalize()
        .map_err(|error| file_io_error("read_failed", &root, error))?;
    let mut files = Vec::new();
    let mut resources = Vec::new();
    let mut truncated = false;
    let mut resources_truncated = false;

    collect_project_files(
        &root,
        &root,
        &mut files,
        &mut resources,
        &mut truncated,
        &mut resources_truncated,
    )?;
    files.sort_by(|left, right| {
        left.relative_path
            .to_ascii_lowercase()
            .cmp(&right.relative_path.to_ascii_lowercase())
    });
    resources.sort_by(|left, right| {
        let left_depth = left.relative_path.split('/').count();
        let right_depth = right.relative_path.split('/').count();
        left_depth
            .cmp(&right_depth)
            .then_with(|| left.kind.cmp(&right.kind))
            .then_with(|| {
                left.relative_path
                    .to_ascii_lowercase()
                    .cmp(&right.relative_path.to_ascii_lowercase())
            })
    });

    Ok(ProjectWorkspace {
        root_name: project_root_name(&root),
        root_path: path_to_string(&root),
        files,
        resources,
        scanned_at: unix_time_millis(SystemTime::now()),
        truncated,
        resources_truncated,
    })
}

fn collect_project_files(
    root: &Path,
    directory: &Path,
    files: &mut Vec<ProjectFileEntry>,
    resources: &mut Vec<ProjectResourceEntry>,
    truncated: &mut bool,
    resources_truncated: &mut bool,
) -> Result<(), FileCommandError> {
    if files.len() >= PROJECT_FILE_LIMIT && resources.len() >= PROJECT_RESOURCE_LIMIT {
        *truncated = true;
        *resources_truncated = true;
        return Ok(());
    }

    let entries =
        fs::read_dir(directory).map_err(|error| file_io_error("read_failed", directory, error))?;
    let mut entries = entries.filter_map(Result::ok).collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.path());

    for entry in entries {
        if files.len() >= PROJECT_FILE_LIMIT && resources.len() >= PROJECT_RESOURCE_LIMIT {
            *truncated = true;
            *resources_truncated = true;
            return Ok(());
        }

        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if file_type.is_dir() {
            if should_skip_project_directory(&path) {
                continue;
            }
            append_project_resource(
                resources,
                resources_truncated,
                ProjectResourceEntry {
                    kind: "directory".to_string(),
                    name: file_name(&path),
                    path: path_to_string(&path),
                    relative_path: relative_project_path(root, &path),
                    modified_at: None,
                },
            );
            if let Err(error) = collect_project_files(
                root,
                &path,
                files,
                resources,
                truncated,
                resources_truncated,
            ) {
                if path == root {
                    return Err(error);
                }
            }
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        let supported_document = is_supported_document_path(&path);
        let modified_at = if supported_document {
            fs::metadata(&path)
                .ok()
                .and_then(|value| value.modified().ok())
                .map(unix_time_millis)
        } else {
            None
        };
        let name = file_name(&path);
        let path_string = path_to_string(&path);
        let relative_path = relative_project_path(root, &path);
        append_project_resource(
            resources,
            resources_truncated,
            ProjectResourceEntry {
                kind: "file".to_string(),
                name: name.clone(),
                path: path_string.clone(),
                relative_path: relative_path.clone(),
                modified_at,
            },
        );
        if !supported_document {
            continue;
        }
        if files.len() >= PROJECT_FILE_LIMIT {
            *truncated = true;
            continue;
        }
        files.push(ProjectFileEntry {
            name,
            path: path_string,
            relative_path,
            modified_at,
        });
    }

    Ok(())
}

fn append_project_resource(
    resources: &mut Vec<ProjectResourceEntry>,
    resources_truncated: &mut bool,
    resource: ProjectResourceEntry,
) {
    if resources.len() >= PROJECT_RESOURCE_LIMIT {
        *resources_truncated = true;
        return;
    }
    resources.push(resource);
}

fn project_root_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(String::from)
        .unwrap_or_else(|| path_to_string(path))
}

fn relative_project_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .map(path_to_string)
        .unwrap_or_else(|_| path_to_string(path))
        .replace('\\', "/")
}

fn should_skip_project_directory(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    matches!(
        name.as_deref(),
        Some(
            ".git"
                | ".hg"
                | ".svn"
                | "node_modules"
                | "dist"
                | "build"
                | ".vite"
                | ".next"
                | "target"
        )
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn project_scanner_keeps_empty_directories_and_ordinary_resources() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("mermaid-project-tree-{unique}"));
        fs::create_dir_all(root.join("docs").join("empty")).expect("create docs");
        fs::create_dir_all(root.join("node_modules").join("ignored")).expect("create ignored");
        fs::write(root.join("docs").join("diagram.mmd"), "flowchart LR").expect("write diagram");
        fs::write(root.join("docs").join("cover.png"), "not-an-image").expect("write resource");
        fs::write(
            root.join("node_modules").join("ignored").join("hidden.md"),
            "# hidden",
        )
        .expect("write ignored");

        let workspace = scan_mermaid_project_folder(root.clone()).expect("scan project");
        let files = workspace
            .files
            .iter()
            .map(|entry| entry.relative_path.as_str())
            .collect::<Vec<_>>();
        let resources = workspace
            .resources
            .iter()
            .map(|entry| (entry.kind.as_str(), entry.relative_path.as_str()))
            .collect::<Vec<_>>();

        assert_eq!(files, vec!["docs/diagram.mmd"]);
        assert!(resources.contains(&("directory", "docs")));
        assert!(resources.contains(&("directory", "docs/empty")));
        assert!(resources.contains(&("file", "docs/diagram.mmd")));
        assert!(resources.contains(&("file", "docs/cover.png")));
        assert!(!resources
            .iter()
            .any(|(_, path)| path.contains("node_modules")));
        assert!(!workspace.resources_truncated);

        fs::remove_dir_all(root).expect("remove fixture");
    }
}
