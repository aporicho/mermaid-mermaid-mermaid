import { useEffect, useState } from "react";
import { OpenNewWindow, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CanvasNode, CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import {
  inferNodeActionKindFromTarget,
  nodeActionDefaultTooltip,
  nodeActionTarget,
  normalizeNodeAction
} from "@/features/mermaid-editor/lib/node-actions";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";

type NodeActionEditorDraft = {
  kind: CanvasNodeAction["kind"];
  target: string;
  openMode: "app-browser" | "system" | "app-window";
  tooltip: string;
};

export function NodeActionEditorDialog({
  node,
  projectFiles,
  onClose,
  onSave,
  onTestOpen
}: {
  node: CanvasNode;
  projectFiles: ProjectFileEntry[];
  onClose: () => void;
  onSave: (nodeId: string, action: CanvasNodeAction | undefined) => void;
  onTestOpen: (action: CanvasNodeAction) => void;
}) {
  const [draft, setDraft] = useState<NodeActionEditorDraft>(() => nodeActionDraftFromNode(node));
  const normalizedAction = nodeActionFromDraft(draft);
  const targetInvalid = draft.target.trim() !== "" && !normalizedAction;
  const selectedProjectFile = projectFiles.find((file) => file.path === draft.target || file.relativePath === draft.target);
  const projectFileSelectValue = selectedProjectFile?.path || "__pick_project_file__";

  useEffect(() => {
    setDraft(nodeActionDraftFromNode(node));
  }, [node]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function updateTarget(target: string) {
    const inferredKind = inferNodeActionKindFromTarget(target);
    setDraft((current) => ({
      ...current,
      target,
      ...(inferredKind && inferredKind !== current.kind
        ? {
            kind: inferredKind,
            openMode: inferredKind === "url" ? "app-browser" : "app-window"
          }
        : {})
    }));
  }

  function updateKind(kind: CanvasNodeAction["kind"]) {
    setDraft((current) => ({
      ...current,
      kind,
      openMode: kind === "url" ? "app-browser" : "app-window"
    }));
  }

  function saveDraft() {
    if (!normalizedAction) return;
    onSave(node.id, normalizedAction);
  }

  function testOpen() {
    if (!normalizedAction) return;
    onTestOpen(normalizedAction);
  }

  return (
    <div
      className="fixed inset-0 grid place-items-center bg-foreground/10 px-4 backdrop-blur-[1px]"
      style={{ zIndex: OVERLAY_Z_INDEX.modal }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    >
      <section className="grid w-[min(520px,100%)] gap-4 rounded-md border bg-card p-4 shadow-sm">
        <header className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">编辑节点链接</div>
            <div className="truncate text-xs text-muted-foreground" title={node.label || node.id}>
              {node.label || node.id}
            </div>
          </div>
          <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={onClose} aria-label="关闭链接编辑器">
            <Xmark className="size-4" />
          </Button>
        </header>

        <div className="grid gap-2">
          <Label>类型</Label>
          <Select value={draft.kind} onValueChange={(value) => updateKind(value as CanvasNodeAction["kind"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="url">网页链接</SelectItem>
              <SelectItem value="file">文件链接</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="node-action-editor-target">{draft.kind === "url" ? "网页 URL" : "文件路径"}</Label>
          <Input
            id="node-action-editor-target"
            value={draft.target}
            placeholder={draft.kind === "url" ? "https://example.com" : "./docs/spec.md"}
            autoFocus
            onChange={(event) => updateTarget(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) saveDraft();
            }}
          />
          {targetInvalid ? (
            <div className="text-xs text-destructive">
              {draft.kind === "url" ? "网页链接需要以 http:// 或 https:// 开头。" : "请输入可解析的文件路径。"}
            </div>
          ) : null}
        </div>

        {draft.kind === "file" && projectFiles.length ? (
          <div className="grid gap-2">
            <Label>从项目选择</Label>
            <Select
              value={projectFileSelectValue}
              onValueChange={(path) => {
                const file = projectFiles.find((item) => item.path === path);
                if (file) updateTarget(file.relativePath || file.path);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                <SelectItem value="__pick_project_file__" disabled>
                  选择项目文件
                </SelectItem>
                {projectFiles.map((file) => (
                  <SelectItem key={file.path} value={file.path}>
                    {file.relativePath || file.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {draft.kind === "url" ? (
          <div className="grid gap-2">
            <Label>打开方式</Label>
            <Select value={draft.openMode} onValueChange={(value) => setDraft((current) => ({ ...current, openMode: value as NodeActionEditorDraft["openMode"] }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app-browser">应用内浏览器</SelectItem>
                <SelectItem value="system">系统浏览器</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="node-action-editor-tooltip">提示文本</Label>
          <Input
            id="node-action-editor-tooltip"
            value={draft.tooltip}
            placeholder={normalizedAction ? nodeActionDefaultTooltip(normalizedAction) : draft.kind === "url" ? "打开链接" : "打开文件"}
            onChange={(event) => setDraft((current) => ({ ...current, tooltip: event.target.value }))}
          />
        </div>

        <footer className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" className="h-8 px-2" onClick={() => onSave(node.id, undefined)}>
            清除链接
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="h-8 px-2" onClick={testOpen} disabled={!normalizedAction}>
              <OpenNewWindow className="size-4" />
              测试打开
            </Button>
            <Button className="h-8 px-3" onClick={saveDraft} disabled={!normalizedAction}>
              保存链接
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function nodeActionDraftFromNode(node: CanvasNode): NodeActionEditorDraft {
  const action = normalizeNodeAction(node.action);
  if (!action) {
    return {
      kind: "url",
      target: "",
      openMode: "app-browser",
      tooltip: ""
    };
  }

  return {
    kind: action.kind,
    target: nodeActionTarget(action),
    openMode: action.kind === "url" ? action.openMode : "app-window",
    tooltip: action.tooltip || ""
  };
}

function nodeActionFromDraft(draft: NodeActionEditorDraft): CanvasNodeAction | undefined {
  const target = draft.target.trim();
  if (!target) return undefined;

  if (draft.kind === "url") {
    return normalizeNodeAction({
      kind: "url",
      url: target,
      openMode: draft.openMode === "system" ? "system" : "app-browser",
      ...(draft.tooltip.trim() ? { tooltip: draft.tooltip.trim() } : {})
    });
  }

  return normalizeNodeAction({
    kind: "file",
    path: target,
    openMode: "app-window",
    ...(draft.tooltip.trim() ? { tooltip: draft.tooltip.trim() } : {})
  });
}
