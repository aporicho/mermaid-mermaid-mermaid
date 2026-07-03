import type { PluginCardDraft } from "@/features/mermaid-editor/lib/content-plugins/registry";
import type { CanvasNodeAction, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { nodeActionSuggestedLabel } from "@/features/mermaid-editor/lib/node-actions";

export function pasteBasePoint(pointer: { x: number; y: number } | null, viewport: ViewportState) {
  return pointer || { x: (420 - viewport.x) / viewport.scale, y: (260 - viewport.y) / viewport.scale };
}

export function contentCardsPasteCommand(cards: PluginCardDraft[], basePoint: { x: number; y: number }): EditorCommand {
  return {
    type: "graph.addNodesAt",
    nodes: cards.map((card, index) => ({
      point: { x: basePoint.x, y: basePoint.y + index * 320 },
      label: card.label,
      action: card.action,
      preview: card.preview
    })),
    message: cards.length > 1 ? `已从剪贴板添加 ${cards.length} 个内容卡片。` : "已从剪贴板添加内容卡片。",
    source: "keyboard"
  };
}

export function actionNodesPasteCommand(actions: CanvasNodeAction[], basePoint: { x: number; y: number }): EditorCommand {
  return {
    type: "graph.addNodesAt",
    nodes: actions.map((action, index) => ({
      point: { x: basePoint.x, y: basePoint.y + index * 104 },
      label: nodeActionSuggestedLabel(action),
      action
    })),
    message: actions.length > 1 ? `已从剪贴板添加 ${actions.length} 个链接节点。` : "已从剪贴板添加链接节点。",
    source: "keyboard"
  };
}
