import { useMemo, useState, type ReactNode } from "react";
import { Plus } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EditorDialog,
  EditorEmptyState,
  EditorField,
  EditorList,
  EditorListRow,
  EditorSearchField,
  EditorSegmentedControl,
  EditorSegmentedControlItem
} from "@/features/mermaid-editor/components/editor-ui";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";

export type ProjectDocumentNodeDialogProps = {
  title: string;
  files: ProjectFileEntry[];
  projectAvailable: boolean;
  creating: boolean;
  existingCollision: ProjectFileEntry | null;
  initialFileName: string;
  fileNamePlaceholder: string;
  searchPlaceholder: string;
  emptyTitle: string;
  fileIcon: ReactNode;
  onClose: () => void;
  onSelect: (file: ProjectFileEntry) => void;
  onCreate: (fileName: string) => void;
  onUseExistingCollision: () => void;
};

export function ProjectDocumentNodeDialog({
  title,
  files,
  projectAvailable,
  creating,
  existingCollision,
  initialFileName,
  fileNamePlaceholder,
  searchPlaceholder,
  emptyTitle,
  fileIcon,
  onClose,
  onSelect,
  onCreate,
  onUseExistingCollision
}: ProjectDocumentNodeDialogProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [fileName, setFileName] = useState(initialFileName);
  const filteredFiles = useMemo(() => {
    const token = query.trim().toLowerCase();
    return token ? files.filter((file) => `${file.name}\n${file.relativePath}`.toLowerCase().includes(token)) : files;
  }, [files, query]);

  return (
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={title}
      size="lg"
      dismissible={!creating}
      className="max-h-[min(680px,calc(100vh-32px))]"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>取消</Button>
          {projectAvailable && mode === "new" ? (
            <Button type="button" onClick={() => onCreate(fileName)} disabled={creating || !fileName.trim()}>
              <Plus />{creating ? "创建中…" : "创建"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid min-h-0 gap-4">
        <EditorSegmentedControl>
          <EditorSegmentedControlItem type="button" active={mode === "existing"} onClick={() => setMode("existing")}>已有</EditorSegmentedControlItem>
          <EditorSegmentedControlItem type="button" active={mode === "new"} onClick={() => setMode("new")}>新建</EditorSegmentedControlItem>
        </EditorSegmentedControl>

        {!projectAvailable ? (
          <EditorEmptyState title="请先打开项目文件夹" />
        ) : mode === "existing" ? (
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <EditorSearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} autoFocus />
            <EditorList className="min-h-0 overflow-y-auto border p-1">
              {filteredFiles.length ? filteredFiles.map((file) => (
                <EditorListRow
                  type="button"
                  key={file.path}
                  icon={fileIcon}
                  title={file.name}
                  tooltip={file.relativePath}
                  onClick={() => onSelect(file)}
                />
              )) : <EditorEmptyState title={emptyTitle} />}
            </EditorList>
          </div>
        ) : (
          <div className="grid content-start gap-3 border p-4">
            <EditorField label="文件名">
              <Input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder={fileNamePlaceholder} autoFocus disabled={creating} />
            </EditorField>
            {existingCollision ? (
              <div className="type-interface-status flex items-center justify-between gap-3 border px-3 py-2">
                <span className="min-w-0 truncate">{existingCollision.name} 已存在，不会覆盖。</span>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onUseExistingCollision}>使用已有</Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </EditorDialog>
  );
}
