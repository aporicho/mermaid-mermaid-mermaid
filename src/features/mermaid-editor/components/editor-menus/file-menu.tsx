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

import { EditorMenuItem, EditorMenuSection, EditorMenuSurface } from "@/features/mermaid-editor/components/editor-ui";
import { FloatingIconButton, FloatingPopover } from "@/features/mermaid-editor/components/floating-chrome";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";

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

      <FloatingPopover open={open} placement="top-left" dismissMode="outside" className="w-72">
        <EditorMenuSurface>
          <EditorMenuSection>
            <EditorMenuItem data-floating-action-item icon={<Plus />} label="新建 Mermaid" onClick={() => runAndClose(onNewMermaidFile)} />
            <EditorMenuItem data-floating-action-item icon={<Text />} label="新建 Markdown" onClick={() => runAndClose(onNewMarkdownFile)} />
            <EditorMenuItem data-floating-action-item icon={<FrameSimple />} label="新建画布" onClick={() => runAndClose(onNewCanvasFile)} />
            <EditorMenuItem data-floating-action-item icon={<Folder />} label="打开文件" onClick={() => runAndClose(onOpenFile)} />
            {projectAvailable ? (
              <EditorMenuItem
                data-floating-action-item
                icon={<Workflow />}
                label="打开文件夹"
                disabled={projectBusy}
                onClick={() => runAndClose(onOpenProject)}
              />
            ) : null}
          </EditorMenuSection>
          <EditorMenuSection className="border-t">
            <EditorMenuItem data-floating-action-item icon={<FloppyDisk />} label="保存" onClick={() => runAndClose(onSaveFile)} />
            <EditorMenuItem data-floating-action-item icon={<FloppyDiskArrowOut />} label="另存为" onClick={() => runAndClose(onSaveAs)} />
          </EditorMenuSection>
          {recentFiles.length ? (
            <EditorMenuSection label="最近" className="border-t">
              {recentFiles.map((file) => (
              <EditorMenuItem
                key={file.path}
                data-floating-action-item
                icon={<ClockRotateRight />}
                label={file.name}
                title={file.path}
                onClick={() => runAndClose(() => onOpenRecent(file))}
              />
              ))}
            </EditorMenuSection>
          ) : null}
        </EditorMenuSurface>
      </FloatingPopover>
    </div>
  );
}
