import { createDesktopRuntime } from "@/features/mermaid-editor/lib/editor-runtime/desktop-runtime";
import { createElectronRuntime } from "@/features/mermaid-editor/lib/editor-runtime/electron-runtime";
import { isElectronRuntime } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";
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
  EditorRuntimeHost,
  EditorRuntime,
  RuntimeBrowserToolWindowResult,
  RuntimeDesktopWindowAction,
  RuntimeEmbeddedBrowserHandle,
  RuntimeEmbeddedBrowserResult,
  RuntimeFileDropRequest,
  RuntimeFileOpenRequest,
  RuntimeFileRef,
  RuntimeImageAssetResult,
  RuntimeLinkPreviewRequest,
  RuntimeLinkPreviewResult,
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
  if (isElectronRuntime()) return createElectronRuntime();
  return isTauriRuntime() ? createDesktopRuntime() : createWebRuntime();
}
