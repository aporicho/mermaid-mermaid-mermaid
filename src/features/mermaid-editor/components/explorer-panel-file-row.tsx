import { useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import {
  EditorTreeItem,
  EditorTreeRow
} from "@/features/mermaid-editor/components/editor-ui";
import { ProjectResourceContextMenu } from "@/features/mermaid-editor/components/explorer-panel-context-menu";
import { ExplorerInlineRename } from "@/features/mermaid-editor/components/explorer-panel-inline-rename";
import {
  ProjectResourceIcon,
  ProjectResourceStatusBadge,
  type ExplorerResourceStatus
} from "@/features/mermaid-editor/components/explorer-resource-ui";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { isHtmlDocumentFilePath } from "@/features/mermaid-editor/lib/html-document";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import {
  isProjectFileActive,
  type ProjectFileEntry,
  type ProjectResourceEntry,
  type ProjectTreeNode
} from "@/features/mermaid-editor/lib/project-workspace";
import { cn } from "@/lib/utils";

export function ProjectFileRow({
  node,
  level,
  parentPath,
  focused,
  selected,
  selectedResources,
  resourceClipboard,
  status,
  currentFileRef,
  activeRowRef,
  onFocusItem,
  onTreeKeyDown,
  onSelectResource,
  onContextMenuResource,
  onDoubleClickResource,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onOpenProjectHtmlWindow,
  onOpenProjectImageWindow,
  projectBusy,
  dragging,
  visualLast,
  renaming,
  onStartFilePointerDrag,
  onMoveFilePointerDrag,
  onFinishFilePointerDrag,
  onCancelFilePointerDrag,
  rootName,
  onMoveResource,
  onCreateFile,
  onCreateDirectory,
  onRenameResource,
  onCommitRename,
  onCancelRename,
  onDeleteResources,
  onCopyResources,
  onPasteResources,
  onCopyPaths,
  onShowInFileManager
}: {
  node: Extract<ProjectTreeNode, { kind: "file" }>;
  level: number;
  parentPath: string;
  focused: boolean;
  selected: boolean;
  selectedResources: ProjectResourceEntry[];
  resourceClipboard: ProjectResourceEntry[];
  status?: ExplorerResourceStatus;
  currentFileRef: RuntimeFileRef | null;
  activeRowRef: { current: HTMLButtonElement | null };
  onFocusItem: (id: string) => void;
  onTreeKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, item: { id: string; kind: "file"; parentPath?: string; resource?: ProjectResourceEntry; file?: ProjectFileEntry }) => void;
  onSelectResource: (resource: ProjectResourceEntry, event: ReactMouseEvent<HTMLButtonElement>, nameClick?: boolean) => void;
  onContextMenuResource: (resource: ProjectResourceEntry) => void;
  onDoubleClickResource: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onOpenProjectHtmlWindow: (file: ProjectFileEntry) => void;
  onOpenProjectImageWindow: (file: ProjectFileEntry) => void;
  projectBusy: boolean;
  dragging: boolean;
  visualLast: boolean;
  renaming: boolean;
  onStartFilePointerDrag: (resource: ProjectResourceEntry, file: ProjectFileEntry | undefined, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMoveFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFinishFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => boolean;
  onCancelFilePointerDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  rootName: string;
  onMoveResource: (resource: ProjectResourceEntry) => void;
  onCreateFile: (directoryPath: string) => void;
  onCreateDirectory: (directoryPath: string) => void;
  onRenameResource: (resource: ProjectResourceEntry) => void;
  onCommitRename: (resource: ProjectResourceEntry, name: string) => void;
  onCancelRename: () => void;
  onDeleteResources: (resources: ProjectResourceEntry[]) => void;
  onCopyResources: (resources: ProjectResourceEntry[]) => void;
  onPasteResources: (directoryPath: string) => void;
  onCopyPaths: (resources: ProjectResourceEntry[], relative?: boolean) => void;
  onShowInFileManager: (resource: ProjectResourceEntry) => void;
}) {
  const htmlFile = isHtmlDocumentFilePath(node.resource.path);
  const imageFile = isSupportedImagePath(node.resource.path);
  const file = node.file ?? (node.resource.documentKind || htmlFile || imageFile ? resourceProjectFile(node.resource) : undefined);
  const active = file ? isProjectFileActive(file, currentFileRef) : false;
  const suppressClickRef = useRef(false);
  const pointerDownNameRef = useRef(false);
  const row = (
    <EditorTreeRow
      ref={(element) => { if (active) activeRowRef.current = element; }}
      active={active || selected}
      data-tree-item-id={node.id}
      data-project-resource-path={node.resource.path}
      data-project-resource-relative-path={node.resource.relativePath}
      data-project-resource-kind="file"
      data-project-resource-parent-path={parentPath}
      data-resource-supported={Boolean(file)}
      data-project-resource-dragging={dragging || undefined}
      aria-level={level}
      aria-selected={active || selected}
      tabIndex={focused ? 0 : -1}
      className={cn(dragging && "pointer-events-none absolute inset-x-0 top-0 cursor-grabbing opacity-0", !file && "text-muted-foreground")}
      title={file ? node.resource.path : `${node.resource.path}\n当前文件类型暂不支持打开`}
      onFocus={() => onFocusItem(node.id)}
      onKeyDown={(event) => {
        if (renaming) return;
        if (!openContextMenuFromKeyboard(event)) {
          onTreeKeyDown(event, { id: node.id, kind: "file", parentPath, resource: node.resource, file });
        }
      }}
      onPointerDown={renaming ? undefined : (event) => {
        pointerDownNameRef.current = isResourceNameEventTarget(event.target);
        onStartFilePointerDrag(node.resource, file, event);
      }}
      onPointerMove={renaming ? undefined : onMoveFilePointerDrag}
      onPointerUp={renaming ? undefined : (event) => {
        if (onFinishFilePointerDrag(event)) suppressClickRef.current = true;
      }}
      onPointerCancel={renaming ? undefined : (event) => {
        pointerDownNameRef.current = false;
        onCancelFilePointerDrag(event);
      }}
      onLostPointerCapture={renaming ? undefined : onCancelFilePointerDrag}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          pointerDownNameRef.current = false;
          event.preventDefault();
          return;
        }
        const nameClick = pointerDownNameRef.current || isResourceNameEventTarget(event.target);
        pointerDownNameRef.current = false;
        if (!renaming) onSelectResource(node.resource, event, nameClick);
      }}
      onDoubleClick={() => { if (!renaming) onDoubleClickResource(node.resource, file); }}
      onContextMenu={(mouseEvent) => {
        if (renaming) {
          mouseEvent.preventDefault();
          return;
        }
        onContextMenuResource(node.resource);
      }}
    >
      <ProjectResourceIcon resource={node.resource} />
      {renaming ? (
        <ExplorerInlineRename
          resource={node.resource}
          projectBusy={projectBusy}
          onCancel={onCancelRename}
          onCommit={(name) => onCommitRename(node.resource, name)}
        />
      ) : (
        <span className="min-w-0 truncate" data-project-resource-name>{node.name}</span>
      )}
      <ProjectResourceStatusBadge status={status || (!file ? "unsupported" : undefined)} />
    </EditorTreeRow>
  );

  return (
    <EditorTreeItem visualLast={visualLast} connectorHidden={dragging}>
      {renaming ? row : (
        <ProjectResourceContextMenu
          menu={{ kind: "file", resource: node.resource, file }}
          rootName={rootName}
          projectBusy={projectBusy}
          selectedResources={selectedResources}
          resourceClipboard={resourceClipboard}
          onOpenProjectFile={onOpenProjectFile}
          onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
          onOpenProjectHtmlWindow={onOpenProjectHtmlWindow}
          onOpenProjectImageWindow={onOpenProjectImageWindow}
          onMove={onMoveResource}
          onCreateFile={onCreateFile}
          onCreateDirectory={onCreateDirectory}
          onRename={onRenameResource}
          onDelete={onDeleteResources}
          onCopyResources={onCopyResources}
          onPasteResources={onPasteResources}
          onCopyPaths={onCopyPaths}
          onShowInFileManager={onShowInFileManager}
        >
          {row}
        </ProjectResourceContextMenu>
      )}
    </EditorTreeItem>
  );
}

function openContextMenuFromKeyboard(event: ReactKeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return false;
  event.preventDefault();
  const trigger = event.currentTarget;
  const bounds = trigger.getBoundingClientRect();
  trigger.dispatchEvent(new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: bounds.left + 20,
    clientY: bounds.top + bounds.height / 2
  }));
  return true;
}

function isResourceNameEventTarget(target: EventTarget | null) {
  return Boolean((target as HTMLElement | null)?.closest("[data-project-resource-name]"));
}

function resourceProjectFile(resource: ProjectResourceEntry): ProjectFileEntry {
  return {
    name: resource.name,
    path: resource.path,
    relativePath: resource.relativePath,
    ...(resource.modifiedAt ? { modifiedAt: resource.modifiedAt } : {})
  };
}
