import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EditorPointMenu } from "@/features/mermaid-editor/components/editor-ui";
import type { CanvasNode, CanvasNodeAction, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import {
  nodeActionDisplayTooltip,
  nodeActionOpenLabel,
  nodeActionTarget,
  normalizeNodeAction
} from "@/features/mermaid-editor/lib/node-actions";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { isCsvTableDocumentNode } from "@/features/mermaid-editor/lib/csv-table-document";

export function NodeActionTooltip({
  node,
  action,
  geometry,
  viewport,
  dimensions
}: {
  node: CanvasNode;
  action: CanvasNodeAction;
  geometry: NodeGeometry;
  viewport: ViewportState;
  dimensions: { width: number; height: number };
}) {
  const width = 280;
  const left = Math.max(8, Math.min(viewport.x + (geometry.frame.x + geometry.frame.width) * viewport.scale + 10, dimensions.width - width - 8));
  const top = Math.max(8, Math.min(viewport.y + geometry.frame.y * viewport.scale - 4, dimensions.height - 74));
  const target = nodeActionTarget(action);

  return (
    <div
      className="editor-ui-popover type-interface-status pointer-events-none absolute grid w-[280px] gap-1 px-3 py-2 text-popover-foreground"
      style={{ left, top, zIndex: OVERLAY_Z_INDEX.tooltip }}
      data-editor-floating-menu-ignore
    >
      <div className="truncate font-medium">{nodeActionDisplayTooltip(action)}</div>
      <div className="truncate text-muted-foreground" title={target}>
        {target}
      </div>
      <div className="sr-only">{node.label || node.id}</div>
    </div>
  );
}

export function NodeContextMenu({
  menu,
  node,
  onClose,
  onOpenNodeAction,
  onEditNodeAction
}: {
  menu: { nodeId: string; x: number; y: number };
  node: CanvasNode | undefined;
  onClose: () => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onEditNodeAction?: (node: CanvasNode) => void;
}) {
  if (!node) return null;

  const action = normalizeNodeAction(node.action);
  const csvTable = isCsvTableDocumentNode(node);

  return <EditorPointMenu
    open
    point={menu}
    onOpenChange={(open) => { if (!open) onClose(); }}
    ariaLabel={`${node.label || node.id} 操作`}
    className="w-[220px]"
  >
    {csvTable
      ? <DropdownMenuItem disabled>双击单元格进行编辑</DropdownMenuItem>
      : <>
        <DropdownMenuItem
          disabled={!action}
          onSelect={() => onOpenNodeAction?.(node)}
        >{nodeActionOpenLabel(action)}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEditNodeAction?.(node)}>
          {action ? "编辑链接" : "添加链接"}
        </DropdownMenuItem>
      </>}
  </EditorPointMenu>;
}
