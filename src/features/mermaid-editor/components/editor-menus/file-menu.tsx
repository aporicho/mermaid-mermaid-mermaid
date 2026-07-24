import {
  ClockRotateRight,
  FloppyDisk,
  FloppyDiskArrowOut,
  Folder,
  GitBranch as Workflow,
  Plus,
  Text
} from "iconoir-react/regular";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { FloatingIconButton } from "@/features/mermaid-editor/components/floating-chrome";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";

export function FileMenu({
  open,
  recentFiles,
  runtimeKind,
  projectBusy,
  isDirty,
  onOpenChange,
  onNewMermaidFile,
  onNewMarkdownFile,
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
  onOpenFile: () => void;
  onOpenRecent: (file: RecentFileEntry) => void;
  onOpenProject: () => void;
  onSaveFile: () => void;
  onSaveAs: () => void;
}) {
  const projectAvailable = runtimeKind === "desktop";

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <FloatingIconButton label="文件" dirty={isDirty} aria-expanded={open}>
          <Folder data-icon />
        </FloatingIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onNewMermaidFile}><Plus data-icon />新建 Mermaid</DropdownMenuItem>
          <DropdownMenuItem onSelect={onNewMarkdownFile}><Text data-icon />新建 Markdown</DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenFile}><Folder data-icon />打开文件</DropdownMenuItem>
            {projectAvailable ? (
              <DropdownMenuItem
                disabled={projectBusy}
                onSelect={onOpenProject}
              ><Workflow data-icon />打开文件夹</DropdownMenuItem>
            ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onSaveFile}><FloppyDisk data-icon />保存</DropdownMenuItem>
          <DropdownMenuItem onSelect={onSaveAs}><FloppyDiskArrowOut data-icon />另存为</DropdownMenuItem>
        </DropdownMenuGroup>
          {recentFiles.length ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>最近</DropdownMenuLabel>
                {recentFiles.map((file) => (
                  <DropdownMenuItem key={file.path} title={file.path} onSelect={() => onOpenRecent(file)}>
                    <ClockRotateRight data-icon />
                    <span className="truncate">{file.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
