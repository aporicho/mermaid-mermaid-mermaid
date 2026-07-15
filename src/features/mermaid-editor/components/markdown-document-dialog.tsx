import { useEffect, useMemo, useState } from "react";
import { EmptyPage, Plus, Search, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { OVERLAY_Z_INDEX, setGlobalOverlayActivity } from "@/lib/overlay-layers";

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

  useEffect(() => {
    setGlobalOverlayActivity("markdown-document-dialog", true);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || creating) return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      setGlobalOverlayActivity("markdown-document-dialog", false);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [creating, onClose]);

  return (
    <div
      className="fixed inset-0 grid place-items-center bg-foreground/10 px-4 backdrop-blur-[1px]"
      style={{ zIndex: OVERLAY_Z_INDEX.modal }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creating) onClose();
      }}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    >
      <section className="grid max-h-[min(680px,calc(100vh-32px))] w-full max-w-xl grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">添加 Markdown 文档</h2>
            <p className="mt-1 text-xs text-muted-foreground">文档卡片可以像普通节点一样建立 Mermaid 连线。</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onClose} disabled={creating} aria-label="关闭">
            <Xmark className="size-4" />
          </Button>
        </header>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <Button type="button" variant={mode === "existing" ? "secondary" : "ghost"} className="h-8" onClick={() => setMode("existing")}>已有文档</Button>
          <Button type="button" variant={mode === "new" ? "secondary" : "ghost"} className="h-8" onClick={() => setMode("new")}>新建文档</Button>
        </div>

        {!projectWorkspace ? (
          <div className="grid min-h-48 place-items-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
            请先通过左侧项目浏览器打开项目文件夹。
          </div>
        ) : mode === "existing" ? (
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Markdown 文档" className="pl-9" autoFocus />
            </label>
            <div className="min-h-0 overflow-y-auto rounded-lg border p-1">
              {markdownFiles.length ? markdownFiles.map((file) => (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-11 w-full justify-start gap-3 px-3 py-2 text-left"
                  key={file.path}
                  onClick={() => onSelect(file)}
                >
                  <EmptyPage className="size-4 shrink-0 text-icon" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{file.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{file.relativePath}</span>
                  </span>
                </Button>
              )) : (
                <div className="grid min-h-32 place-items-center text-sm text-muted-foreground">没有匹配的 Markdown 文档</div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid content-start gap-3 rounded-lg border p-4">
            <label className="grid gap-2 text-sm">
              <span>项目根目录文件名</span>
              <Input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="design.md" autoFocus disabled={creating} />
            </label>
            <p className="text-xs text-muted-foreground">只允许文件名，不允许子目录；省略扩展名时自动使用 .md。</p>
            {existingCollision ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-xs">
                <span className="min-w-0 truncate">{existingCollision.name} 已存在，不会覆盖。</span>
                <Button type="button" variant="outline" className="h-8 shrink-0" onClick={onUseExistingCollision}>关联已有文档</Button>
              </div>
            ) : null}
          </div>
        )}

        <footer className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>取消</Button>
          {projectWorkspace && mode === "new" ? (
            <Button type="button" onClick={() => onCreate(fileName)} disabled={creating || !fileName.trim()}>
              <Plus className="size-4" />
              {creating ? "正在创建…" : "创建并添加"}
            </Button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
