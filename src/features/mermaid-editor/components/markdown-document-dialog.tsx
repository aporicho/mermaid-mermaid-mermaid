import { useMemo, useState } from "react";
import { EmptyPage, Plus } from "iconoir-react/regular";

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
import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export function MarkdownDocumentDialog({
  projectWorkspace,
  creating,
  existingCollision,
  onClose,
  onSelect,
  onCreate,
  onUseExistingCollision
}: {
  projectWorkspace: ProjectWorkspace | null;
  creating: boolean;
  existingCollision: ProjectFileEntry | null;
  onClose: () => void;
  onSelect: (file: ProjectFileEntry) => void;
  onCreate: (fileName: string) => void;
  onUseExistingCollision: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [fileName, setFileName] = useState("untitled.md");
  const markdownFiles = useMemo(() => {
    const token = query.trim().toLowerCase();
    return (projectWorkspace?.files || []).filter((file) => {
      if (!isSupportedMarkdownFilePath(file.path)) return false;
      return !token || `${file.name}\n${file.relativePath}`.toLowerCase().includes(token);
    });
  }, [projectWorkspace?.files, query]);

  return (
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Markdown 文档"
      size="lg"
      dismissible={!creating}
      className="max-h-[min(680px,calc(100vh-32px))]"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>取消</Button>
          {projectWorkspace && mode === "new" ? (
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

        {!projectWorkspace ? (
          <EditorEmptyState title="请先打开项目文件夹" />
        ) : mode === "existing" ? (
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <EditorSearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Markdown 文档" autoFocus />
            <EditorList className="min-h-0 overflow-y-auto border p-1">
              {markdownFiles.length ? markdownFiles.map((file) => (
                <EditorListRow
                  type="button"
                  key={file.path}
                  icon={<EmptyPage />}
                  title={file.name}
                  tooltip={file.relativePath}
                  onClick={() => onSelect(file)}
                />
              )) : (
                <EditorEmptyState title="没有匹配的 Markdown 文档" />
              )}
            </EditorList>
          </div>
        ) : (
          <div className="grid content-start gap-3 border p-4">
            <EditorField label="文件名">
              <Input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="design.md" autoFocus disabled={creating} />
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
