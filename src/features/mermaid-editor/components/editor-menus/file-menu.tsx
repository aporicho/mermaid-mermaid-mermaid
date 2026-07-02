import {
  ClockRotateRight,
  FloppyDisk,
  FloppyDiskArrowOut,
  Folder,
  FrameSimple,
  GitBranch as Workflow,
  Plus,
  Text
} from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FloatingIconButton, FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";
import { cn } from "@/lib/utils";

export function FileMenu({
  open,
  recentFiles,
  runtimeKind,
  projectBusy,
  isDirty,
  onOpenChange,
  onNewMermaidFile,
  onNewMarkdownFile,
  onNewCanvasFile,
  onOpenFile,
  onOpenRecent,
  onOpenProject,
  onSaveFile,
  onSaveAs
}: {
  open: boolean;
  recentFiles: RecentFileEntry[];
  runtimeKind: "web" | "desktop";
  projectBusy: boolean;
  isDirty: boolean;
  onOpenChange: (open: boolean) => void;
  onNewMermaidFile: () => void;
  onNewMarkdownFile: () => void;
  onNewCanvasFile: () => void;
  onOpenFile: () => void;
  onOpenRecent: (file: RecentFileEntry) => void;
  onOpenProject: () => void;
  onSaveFile: () => void;
  onSaveAs: () => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open, onOpenChange });
  const projectAvailable = runtimeKind === "desktop";

  function runAndClose(action: () => void) {
    action();
    onOpenChange(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <FloatingIconButton label="文件" dirty={isDirty} onClick={() => onOpenChange(!open)} aria-expanded={open}>
        <Folder />
      </FloatingIconButton>

      <FloatingPanel open={open} placement="top-left" kind="popover" dismissMode="outside" className="w-72">
        <div className="grid gap-0.5">
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onNewMermaidFile)}>
            <Plus className="size-4" />
            新建 Mermaid
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onNewMarkdownFile)}>
            <Text className="size-4" />
            新建 Markdown
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onNewCanvasFile)}>
            <FrameSimple className="size-4" />
            新建无限画布
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onOpenFile)}>
            <Folder className="size-4" />
            打开文件
          </Button>
          {projectAvailable ? (
            <Button
              data-floating-action-item
              variant="ghost"
              className={EDITOR_CHROME_CLASSES.menuRow}
              disabled={projectBusy}
              onClick={() => runAndClose(onOpenProject)}
            >
              <Workflow className="size-4" />
              打开文件夹
            </Button>
          ) : null}
          <Separator className="my-1" />
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onSaveFile)}>
            <FloppyDisk className="size-4" />
            保存
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onSaveAs)}>
            <FloppyDiskArrowOut className="size-4" />
            另存为
          </Button>
          <Separator className="my-1" />
          <div data-floating-action-item className="px-2 py-1 text-xs text-muted-foreground">最近打开</div>
          {recentFiles.length ? (
            recentFiles.map((file) => (
              <Button
                key={file.path}
                data-floating-action-item
                variant="ghost"
                className={cn(EDITOR_CHROME_CLASSES.menuRow, "w-full min-w-0 gap-2 overflow-hidden text-left")}
                title={file.path}
                onClick={() => runAndClose(() => onOpenRecent(file))}
              >
                <ClockRotateRight className="size-4 shrink-0" />
                <span className="block min-w-0 flex-1 overflow-hidden truncate">{file.name}</span>
              </Button>
            ))
          ) : (
            <div data-floating-action-item className="px-2 py-2 text-xs text-muted-foreground">暂无最近文件</div>
          )}
        </div>
      </FloatingPanel>
    </div>
  );
}
