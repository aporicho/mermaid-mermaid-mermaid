import { useCallback } from "react";
import { createPortal } from "react-dom";
import { Circle, Group, Text } from "react-konva";

import { EditorMenuItem, EditorMenuSurface } from "@/features/mermaid-editor/components/editor-ui";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, CanvasNodeAction, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import {
  nodeActionDisplayTooltip,
  nodeActionOpenLabel,
  nodeActionTarget,
  normalizeNodeAction
} from "@/features/mermaid-editor/lib/node-actions";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayRegistration } from "@/lib/use-overlay-registration";
import type { TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { isCsvTableDocumentNode } from "@/features/mermaid-editor/lib/csv-table-document";

export function CanvasNodeActionBadge({
  actionKind,
  x,
  y,
  visualTokens,
  typography,
  onOpen
}: {
  actionKind: "url" | "file";
  x: number;
  y: number;
  visualTokens: CanvasVisualTokens;
  typography: TypographyRoleTokens;
  onOpen?: () => void;
}) {
  const size = 18;

  return (
    <Group
      x={x}
      y={y}
      onMouseDown={(event) => {
        event.cancelBubble = true;
      }}
      onClick={(event) => {
        event.cancelBubble = true;
        onOpen?.();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onOpen?.();
      }}
    >
      <Circle
        x={size / 2}
        y={size / 2}
        radius={size / 2}
        fill={visualTokens.colors.surface}
        stroke={visualTokens.colors.accent}
        strokeWidth={1.5}
        opacity={0.96}
      />
      <Text
        width={size}
        height={size}
        text={actionKind === "url" ? "↗" : "F"}
        align="center"
        verticalAlign="middle"
        fontSize={typography.fontSize}
        fontStyle={String(typography.fontWeight)}
        fontFamily={typography.family}
        lineHeight={typography.lineHeight / typography.fontSize}
        letterSpacing={typography.letterSpacing}
        fill={visualTokens.colors.accent}
      />
    </Group>
  );
}

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
  const overlayToken = `node-context-menu:${menu.nodeId}`;
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) onClose();
  }, [onClose]);
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({
    open: Boolean(node),
    onOpenChange: handleOpenChange
  });

  useOverlayRegistration(overlayToken, Boolean(node));

  if (!node) return null;

  const action = normalizeNodeAction(node.action);
  const csvTable = isCsvTableDocumentNode(node);
  const width = 220;
  const height = 80;
  const viewportWidth = typeof window === "undefined" ? menu.x + width + 16 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? menu.y + height + 16 : window.innerHeight;
  const left = Math.max(8, Math.min(menu.x, viewportWidth - width - 8));
  const top = Math.max(8, Math.min(menu.y, viewportHeight - height - 8));

  const menuElement = (
    <EditorMenuSurface
      ref={menuRef}
      className="editor-ui-popover fixed w-[220px] p-1 text-foreground"
      style={{ left, top, zIndex: OVERLAY_Z_INDEX.contextMenu }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    >
      {csvTable ? <EditorMenuItem type="button" label="双击单元格进行编辑" disabled /> : <><EditorMenuItem
        type="button"
        label={nodeActionOpenLabel(action)}
        disabled={!action}
        onClick={() => {
          if (node) onOpenNodeAction?.(node);
          onClose();
        }}
      />
      <EditorMenuItem
        type="button"
        label={action ? "编辑链接" : "添加链接"}
        onClick={() => {
          onEditNodeAction?.(node);
          onClose();
        }}
      /></>}
    </EditorMenuSurface>
  );

  if (typeof document === "undefined") return menuElement;
  return createPortal(menuElement, document.body);
}
