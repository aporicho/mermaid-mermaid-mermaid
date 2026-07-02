import { createDesktopRuntime } from "@/features/mermaid-editor/lib/editor-runtime/desktop-runtime";
import { isTauriRuntime } from "@/features/mermaid-editor/lib/editor-runtime/tauri-bridge";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime/types";
import { createWebRuntime } from "@/features/mermaid-editor/lib/editor-runtime/web-runtime";

export {
  EDITOR_DRAFT_STORAGE_KEY,
  ensureRuntimeDocumentFileName,
  ensureRuntimeMermaidFileName,
  isRuntimeAbortError
} from "@/features/mermaid-editor/lib/editor-runtime/shared";
export type {
  EditorDraftState,
  EditorRuntime,
  RuntimeDesktopWindowAction,
  RuntimeEmbeddedBrowserHandle,
  RuntimeEmbeddedBrowserResult,
  RuntimeFileDropRequest,
  RuntimeFileOpenRequest,
  RuntimeFileRef,
  RuntimeImageAssetResult,
  RuntimeOpenFileResult,
  RuntimeProjectFolderResult,
  RuntimeSaveFileResult,
  RuntimeTerminalDataEvent,
  RuntimeTerminalExitEvent,
  RuntimeTerminalOpenResult,
  RuntimeTerminalSession,
  RuntimeTerminalShellOption
} from "@/features/mermaid-editor/lib/editor-runtime/types";

export function createEditorRuntime(): EditorRuntime {
  return isTauriRuntime() ? createDesktopRuntime() : createWebRuntime();
}
