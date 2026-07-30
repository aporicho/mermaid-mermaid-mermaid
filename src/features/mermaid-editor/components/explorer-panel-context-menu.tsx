import { useRef, type ReactElement } from "react";
import {
  Copy,
  Download,
  EditPencil,
  Finder,
  FolderPlus,
  MediaImage,
  MultiplePages,
  OpenNewWindow,
  Page,
  PageEdit,
  PagePlus,
  PasteClipboard,
  PathArrow,
  Trash
} from "iconoir-react/regular";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { isHtmlDocumentFilePath } from "@/features/mermaid-editor/lib/html-document";
import { isCsvTableFilePath } from "@/features/mermaid-editor/lib/csv-table-document";
import { isTextDocumentFilePath } from "@/features/mermaid-editor/lib/text-document";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import type { ProjectFileEntry, ProjectResourceEntry } from "@/features/mermaid-editor/lib/project-workspace";
import { useExplorerMarkdownExport } from "@/features/mermaid-editor/components/explorer-markdown-export";

export type ExplorerContextMenu = {
  kind: "file";
  resource: ProjectResourceEntry;
  file?: ProjectFileEntry;
} | {
  kind: "directory";
  directoryPath: string;
};

export function ProjectResourceContextMenu({
  menu,
  rootName,
  projectBusy,
  selectedResources,
  resourceClipboard,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onOpenProjectHtmlWindow,
  onOpenProjectImageWindow,
  onOpenProjectAuxiliaryWindow,
  onMove,
  onCreateFile,
  onCreateDirectory,
  onRename,
  onDelete,
  onCopyResources,
  onPasteResources,
  onCopyPaths,
  onShowInFileManager,
  children
}: {
  menu: ExplorerContextMenu;
  rootName: string;
  projectBusy: boolean;
  selectedResources: ProjectResourceEntry[];
  resourceClipboard: ProjectResourceEntry[];
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onOpenProjectHtmlWindow: (file: ProjectFileEntry) => void;
  onOpenProjectImageWindow: (file: ProjectFileEntry) => void;
  onOpenProjectAuxiliaryWindow?: (file: ProjectFileEntry) => void;
  onMove: (resource: ProjectResourceEntry) => void;
  onCreateFile: (directoryPath: string) => void;
  onCreateDirectory: (directoryPath: string) => void;
  onRename: (resource: ProjectResourceEntry) => void;
  onDelete: (resources: ProjectResourceEntry[]) => void;
  onCopyResources: (resources: ProjectResourceEntry[]) => void;
  onPasteResources: (directoryPath: string) => void;
  onCopyPaths: (resources: ProjectResourceEntry[], relative?: boolean) => void;
  onShowInFileManager: (resource: ProjectResourceEntry) => void;
  children: ReactElement;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const markdownExport = useExplorerMarkdownExport();
  const fileMenu = menu.kind === "file";
  const resource = fileMenu ? menu.resource : undefined;
  const directoryMenu = menu.kind === "directory" || resource?.kind === "directory";
  const directoryPath = menu.kind === "directory"
    ? menu.directoryPath
    : resource?.kind === "directory" ? resource.relativePath : resource ? parentResourceDirectory(resource.relativePath) : "";
  const actionResources = resource
    ? selectedResources.some((candidate) => candidate.path === resource.path) ? selectedResources : [resource]
    : selectedResources;
  const markdownFile = fileMenu && resource?.kind === "file" && resource.documentKind === "markdown" && Boolean(menu.file);
  const htmlFile = fileMenu && resource?.kind === "file" && isHtmlDocumentFilePath(resource.path) && Boolean(menu.file);
  const imageFile = fileMenu && resource?.kind === "file" && isSupportedImagePath(resource.path) && Boolean(menu.file);
  const auxiliaryFile = fileMenu && resource?.kind === "file" && (isTextDocumentFilePath(resource.path) || isCsvTableFilePath(resource.path)) && Boolean(menu.file);
  const targetName = fileMenu ? menu.resource.name : menu.directoryPath.split("/").at(-1) || rootName;

  return (
    <ContextMenu>
      <ContextMenuTrigger ref={triggerRef} asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        aria-label={`${targetName} 操作`}
        onEscapeKeyDown={() => window.requestAnimationFrame(() => {
          if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
        })}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
        }}
      >
        {fileMenu && resource?.kind === "file" ? (
          <>
            {menu.file ? (
              <ContextMenuGroup>
                {!htmlFile && !imageFile ? (
                  <ContextMenuItem title={menu.file.path} onSelect={() => onOpenProjectFile(menu.file!)}>
                    <Page data-icon />
                    <span className="truncate">打开</span>
                  </ContextMenuItem>
                ) : null}
                {markdownFile ? (
                  <ContextMenuItem title={menu.file.path} onSelect={() => onOpenProjectMarkdownWindow(menu.file!)}>
                    <OpenNewWindow data-icon />
                    <span className="truncate">在浮窗中打开</span>
                  </ContextMenuItem>
                ) : null}
                {markdownFile && markdownExport ? (
                  <ContextMenuItem
                    disabled={projectBusy || Boolean(markdownExport.busyPath)}
                    onSelect={() => window.requestAnimationFrame(() => void markdownExport.exportFile(menu.file!))}
                  >
                    <Download data-icon />
                    <span className="truncate">导出文档与资源…</span>
                  </ContextMenuItem>
                ) : null}
                {auxiliaryFile && onOpenProjectAuxiliaryWindow ? (
                  <ContextMenuItem title={menu.file.path} onSelect={() => onOpenProjectAuxiliaryWindow(menu.file!)}>
                    <OpenNewWindow data-icon />
                    <span className="truncate">在浮窗中打开</span>
                  </ContextMenuItem>
                ) : null}
                {htmlFile ? (
                  <ContextMenuItem title={menu.file.path} onSelect={() => onOpenProjectHtmlWindow(menu.file!)}>
                    <OpenNewWindow data-icon />
                    <span className="truncate">在浮窗中预览</span>
                  </ContextMenuItem>
                ) : null}
                {imageFile ? (
                  <ContextMenuItem title={menu.file.path} onSelect={() => onOpenProjectImageWindow(menu.file!)}>
                    <MediaImage data-icon />
                    <span className="truncate">在图片查看器中打开</span>
                  </ContextMenuItem>
                ) : null}
              </ContextMenuGroup>
            ) : null}
          </>
        ) : null}
        {directoryMenu ? (
          <>
            {fileMenu && resource?.kind === "file" ? <ContextMenuSeparator /> : null}
            <ContextMenuGroup>
              <ContextMenuItem disabled={projectBusy} onSelect={() => window.requestAnimationFrame(() => onCreateFile(directoryPath))}>
                <PagePlus data-icon />
                <span className="truncate">新建文件…</span>
              </ContextMenuItem>
              <ContextMenuItem disabled={projectBusy} onSelect={() => window.requestAnimationFrame(() => onCreateDirectory(directoryPath))}>
                <FolderPlus data-icon />
                <span className="truncate">新建文件夹…</span>
              </ContextMenuItem>
              <ContextMenuItem disabled={projectBusy || !resourceClipboard.length} onSelect={() => window.requestAnimationFrame(() => onPasteResources(directoryPath))}>
                <PasteClipboard data-icon />
                <span className="truncate">粘贴</span>
              </ContextMenuItem>
            </ContextMenuGroup>
          </>
        ) : null}
        {resource ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuItem title={resource.path} disabled={projectBusy || actionResources.length !== 1} onSelect={() => window.requestAnimationFrame(() => onMove(resource))}>
                <PathArrow data-icon />
                <span className="truncate">移动到…</span>
              </ContextMenuItem>
              <ContextMenuItem disabled={projectBusy || actionResources.length !== 1} onSelect={() => window.requestAnimationFrame(() => onRename(resource))}>
                <EditPencil data-icon />
                <span className="truncate">重命名</span>
              </ContextMenuItem>
              <ContextMenuItem disabled={projectBusy} onSelect={() => window.requestAnimationFrame(() => onDelete(actionResources))}>
                <Trash data-icon />
                <span className="truncate">删除</span>
              </ContextMenuItem>
              <ContextMenuItem disabled={projectBusy} onSelect={() => onCopyResources(actionResources)}>
                <Copy data-icon />
                <span className="truncate">复制</span>
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onCopyPaths(actionResources)}>
                <MultiplePages data-icon />
                <span className="truncate">复制路径</span>
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onCopyPaths(actionResources, true)}>
                <PageEdit data-icon />
                <span className="truncate">复制相对路径</span>
              </ContextMenuItem>
              <ContextMenuItem disabled={actionResources.length !== 1} onSelect={() => onShowInFileManager(resource)}>
                <Finder data-icon />
                <span className="truncate">在 Finder 中显示</span>
              </ContextMenuItem>
            </ContextMenuGroup>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function parentResourceDirectory(relativePath: string) {
  const segments = relativePath.replaceAll("\\", "/").split("/");
  segments.pop();
  return segments.join("/");
}
