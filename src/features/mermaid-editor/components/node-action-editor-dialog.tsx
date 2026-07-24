import { useEffect, useState } from "react";
import { OpenNewWindow } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditorDialog, EditorField, EditorFieldError } from "@/features/mermaid-editor/components/editor-ui";
import type { CanvasNode, CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import {
  inferNodeActionKindFromTarget,
  nodeActionDefaultTooltip,
  nodeActionTarget,
  normalizeNodeAction
} from "@/features/mermaid-editor/lib/node-actions";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";

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
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={<span title={node.label || node.id}>节点链接</span>}
      size="md"
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onSave(node.id, undefined)}>清除</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={testOpen} disabled={!normalizedAction}><OpenNewWindow />测试</Button>
            <Button size="sm" onClick={saveDraft} disabled={!normalizedAction}>保存</Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4">
        <EditorField label="类型">
          <Select value={draft.kind} onValueChange={(value) => updateKind(value as CanvasNodeAction["kind"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="url">网页链接</SelectItem>
              <SelectItem value="file">文件链接</SelectItem>
            </SelectContent>
          </Select>
        </EditorField>

        <EditorField label={draft.kind === "url" ? "网页 URL" : "文件路径"} htmlFor="node-action-editor-target">
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
          {targetInvalid ? <EditorFieldError>{draft.kind === "url" ? "网页链接需要以 http:// 或 https:// 开头。" : "请输入可解析的文件路径。"}</EditorFieldError> : null}
        </EditorField>

        {draft.kind === "file" && projectFiles.length ? (
          <EditorField label="项目文件">
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
          </EditorField>
        ) : null}

        {draft.kind === "url" ? (
          <EditorField label="打开方式">
            <Select value={draft.openMode} onValueChange={(value) => setDraft((current) => ({ ...current, openMode: value as NodeActionEditorDraft["openMode"] }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app-browser">应用内浏览器</SelectItem>
                <SelectItem value="system">系统浏览器</SelectItem>
              </SelectContent>
            </Select>
          </EditorField>
        ) : null}

        <EditorField label="提示文本" htmlFor="node-action-editor-tooltip">
          <Input
            id="node-action-editor-tooltip"
            value={draft.tooltip}
            placeholder={normalizedAction ? nodeActionDefaultTooltip(normalizedAction) : draft.kind === "url" ? "打开链接" : "打开文件"}
            onChange={(event) => setDraft((current) => ({ ...current, tooltip: event.target.value }))}
          />
        </EditorField>
      </div>
    </EditorDialog>
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
