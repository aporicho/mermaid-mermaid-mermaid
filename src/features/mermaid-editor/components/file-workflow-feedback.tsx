import { WarningTriangle, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { EditorDialog, EditorIconButton, EditorNotice } from "@/features/mermaid-editor/components/editor-ui";
import {
  fileWorkflowErrorSuggestion,
  fileWorkflowErrorTitle,
  type FileWorkflowError
} from "@/features/mermaid-editor/lib/file-workflow";
import type { UnsavedPromptChoice } from "@/features/mermaid-editor/lib/desktop-close-workflow";
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
  return (
    <EditorDialog
      open
      onOpenChange={() => undefined}
      title={prompt.title}
      icon={<WarningTriangle className="editor-ui-icon mt-0.5 shrink-0 text-icon" />}
      size="sm"
      dismissible={false}
      footer={<><Button variant="ghost" onClick={() => onResolve("cancel")}>取消</Button><Button variant="outline" onClick={() => onResolve("discard")}>丢弃</Button><Button onClick={() => onResolve("save")}>保存</Button></>}
    >
      <p className="type-interface-body text-muted-foreground">{prompt.description}</p>
      {prompt.targetName ? <p className="type-interface-technical mt-2 truncate text-muted-foreground">{prompt.targetName}</p> : null}
    </EditorDialog>
  );
}
