import { WarningTriangle, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
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
        "pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur",
        feedback.tone === "blocked" ? "border-destructive/30 text-destructive" : "border-border text-foreground"
      )}
      style={style}
    >
      {feedback.message}
    </div>
  );
}

export function FileWorkflowErrorBanner({ error, onClose }: { error: FileWorkflowError; onClose: () => void }) {
  return (
    <div
      className="fixed left-1/2 top-14 w-[min(520px,calc(100vw-24px))] -translate-x-1/2 rounded-md border border-destructive/30 bg-card/95 p-3 text-sm shadow-sm backdrop-blur"
      style={{ zIndex: OVERLAY_Z_INDEX.banner }}
    >
      <div className="flex items-start gap-3">
        <WarningTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">{fileWorkflowErrorTitle(error.code)}</div>
          <div className="mt-1 break-words text-xs text-muted-foreground">{error.message}</div>
          {error.path ? <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{error.path}</div> : null}
          <div className="mt-2 text-xs text-muted-foreground">{fileWorkflowErrorSuggestion(error.code)}</div>
        </div>
        <Button size="icon" variant="ghost" className="size-8 shrink-0 text-icon hover:text-icon" onClick={onClose} aria-label="关闭文件错误提示">
          <Xmark className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function UnsavedFilePrompt({ prompt, onResolve }: { prompt: UnsavedPromptContent; onResolve: (choice: UnsavedPromptChoice) => void }) {
  return (
    <div className="fixed inset-0 grid place-items-center bg-foreground/10 px-4 backdrop-blur-[1px]" style={{ zIndex: OVERLAY_Z_INDEX.modal }}>
      <section className="w-[min(416px,100%)] rounded-md border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <WarningTriangle className="mt-0.5 size-4 shrink-0 text-icon" />
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-foreground">{prompt.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{prompt.description}</p>
            {prompt.targetName ? <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{prompt.targetName}</p> : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" className="h-8 px-3" onClick={() => onResolve("cancel")}>
            取消
          </Button>
          <Button variant="outline" className="h-8 px-3" onClick={() => onResolve("discard")}>
            丢弃
          </Button>
          <Button className="h-8 px-3" onClick={() => onResolve("save")}>
            保存
          </Button>
        </div>
      </section>
    </div>
  );
}
