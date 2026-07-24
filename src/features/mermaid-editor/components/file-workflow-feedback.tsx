import { WarningTriangle, Xmark } from "iconoir-react/regular";

import { EditorConfirmDialog, EditorIconButton, EditorNotice } from "@/features/mermaid-editor/components/editor-ui";
import {
  fileWorkflowErrorSuggestion,
  fileWorkflowErrorTitle,
  type FileWorkflowError
} from "@/features/mermaid-editor/lib/file-workflow";
import type { UnsavedPromptChoice } from "@/features/mermaid-editor/lib/desktop-close-workflow";
import type { FileConflictChoice } from "@/features/mermaid-editor/components/mermaid-editor/file-workflow/types";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { cn } from "@/lib/utils";

export type FileDropFeedback = {
  message: string;
  tone: "ready" | "blocked";
  position?: {
    x: number;
    y: number;
  };
};

export type UnsavedPromptContent = {
  title: string;
  description: string;
  targetName?: string;
  targetNames?: string[];
  mode?: "single" | "window-close";
};

export function FileDropFeedbackBadge({ feedback }: { feedback: FileDropFeedback }) {
  const style = feedback.position
    ? {
        left: Math.max(12, feedback.position.x),
        top: Math.max(12, feedback.position.y)
      }
    : {
        left: "50%",
        top: "50%"
      };

  return (
    <div
      className={cn(
        "editor-ui-surface type-interface-status pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-1/2 px-3 py-2",
        feedback.tone === "blocked" ? "border-destructive/30 text-destructive" : "border-border text-foreground"
      )}
      style={style}
      data-overlay-layer="feedback"
      data-overlay-scope-id="application"
    >
      {feedback.message}
    </div>
  );
}

export function FileWorkflowErrorBanner({ error, onClose }: { error: FileWorkflowError; onClose: () => void }) {
  return (
    <EditorNotice
      tone="danger"
      icon={<WarningTriangle className="editor-ui-icon mt-0.5 shrink-0 text-destructive" />}
      title={fileWorkflowErrorTitle(error.code)}
      description={<><div className="mt-1 break-words">{error.message}</div>{error.path ? <div className="type-interface-technical mt-1 truncate">{error.path}</div> : null}<div className="mt-2">{fileWorkflowErrorSuggestion(error.code)}</div></>}
      actions={<EditorIconButton context="inline" tone="danger" label="关闭文件错误提示" onClick={onClose}><Xmark /></EditorIconButton>}
      className="fixed left-1/2 top-14 w-[min(520px,calc(100vw-24px))] -translate-x-1/2"
      style={{ zIndex: OVERLAY_Z_INDEX.banner }}
      data-overlay-layer="banner"
      data-overlay-scope-id="application"
    />
  );
}

export function UnsavedFilePrompt({ prompt, onResolve }: { prompt: UnsavedPromptContent; onResolve: (choice: UnsavedPromptChoice) => void }) {
  const windowClose = prompt.mode === "window-close";
  return (
    <EditorConfirmDialog
      open
      title={prompt.title}
      icon={<WarningTriangle className="editor-ui-icon mt-0.5 shrink-0 text-icon" />}
      size="sm"
      actions={[
        { id: "discard", label: windowClose ? "丢弃全部" : "丢弃", tone: "danger" },
        { id: "cancel", label: "取消" },
        ...(windowClose ? [{ id: "preserve" as const, label: "保留草稿" }] : []),
        { id: "save", label: windowClose ? "全部保存" : "保存", tone: "primary" }
      ]}
      primaryActionId="save"
      cancelActionId="cancel"
      onAction={onResolve}
      handleEscape={false}
    >
      {prompt.description ? <p className="type-interface-body text-muted-foreground">{prompt.description}</p> : null}
      {prompt.targetNames?.length ? (
        <ul className="mt-1 max-h-48 overflow-y-auto" aria-label="未保存文件">
          {prompt.targetNames.map((name, index) => (
            <li key={`${index}:${name}`} className="type-interface-navigation flex min-h-[var(--ui-control-height-sm)] items-center gap-2 px-1">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="min-w-0 truncate">{name}</span>
            </li>
          ))}
        </ul>
      ) : prompt.targetName ? <p className="type-interface-technical mt-2 truncate text-muted-foreground">{prompt.targetName}</p> : null}
    </EditorConfirmDialog>
  );
}

export function FileConflictPrompt({ fileName, path, onResolve }: {
  fileName: string;
  path?: string;
  onResolve: (choice: FileConflictChoice) => void;
}) {
  return (
    <EditorConfirmDialog
      open
      title={`${fileName} 已在外部修改`}
      icon={<WarningTriangle className="editor-ui-icon mt-0.5 shrink-0 text-icon" />}
      size="sm"
      actions={[
        { id: "reload", label: "载入磁盘", tone: "danger" },
        { id: "cancel", label: "取消" },
        { id: "save-as", label: "另存为" },
        { id: "overwrite", label: "覆盖磁盘", tone: "primary" }
      ]}
      primaryActionId="overwrite"
      cancelActionId="cancel"
      onAction={onResolve}
    >
      <p className="type-interface-body text-muted-foreground">本地修改仍然保留。请选择要保留的版本。</p>
      {path ? <p className="type-interface-technical mt-2 truncate text-muted-foreground">{path}</p> : null}
    </EditorConfirmDialog>
  );
}
