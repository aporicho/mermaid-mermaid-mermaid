import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Circle, Group, Text } from "react-konva";

import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, CanvasNodeAction, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import {
  nodeActionDisplayTooltip,
  nodeActionLabel,
  nodeActionOpenLabel,
  nodeActionTarget,
  normalizeNodeAction
} from "@/features/mermaid-editor/lib/node-actions";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";
import { OVERLAY_Z_INDEX, setGlobalOverlayActivity } from "@/lib/overlay-layers";

export function CanvasNodeActionBadge({
  actionKind,
  x,
  y,
  visualTokens,
  onOpen
}: {
  actionKind: "url" | "file";
  x: number;
  y: number;
  visualTokens: CanvasVisualTokens;
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
        fontSize={actionKind === "url" ? 13 : 10}
        fontStyle="700"
        fontFamily="system-ui, sans-serif"
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
      className="pointer-events-none absolute grid w-[280px] gap-1 rounded-md border bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-lg backdrop-blur"
      style={{ left, top, zIndex: OVERLAY_Z_INDEX.tooltip }}
      data-editor-floating-menu-ignore
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="font-medium">{nodeActionLabel(action)}</span>
        <span className="truncate text-muted-foreground">{nodeActionDisplayTooltip(action)}</span>
      </div>
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

  useEffect(() => {
    setGlobalOverlayActivity(overlayToken, true);
    return () => setGlobalOverlayActivity(overlayToken, false);
  }, [overlayToken]);

  if (!node) return null;

  const action = normalizeNodeAction(node.action);
  const width = 220;
  const height = 80;
  const viewportWidth = typeof window === "undefined" ? menu.x + width + 16 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? menu.y + height + 16 : window.innerHeight;
  const left = Math.max(8, Math.min(menu.x, viewportWidth - width - 8));
  const top = Math.max(8, Math.min(menu.y, viewportHeight - height - 8));

  const menuElement = (
    <div
      ref={menuRef}
      className="fixed w-[220px] rounded-md border bg-card/95 p-1 text-sm text-foreground shadow-xl"
      style={{ left, top, zIndex: OVERLAY_Z_INDEX.contextMenu }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    >
      <button
        type="button"
        className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded px-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!action}
        onClick={() => {
          if (node) onOpenNodeAction?.(node);
          onClose();
        }}
      >
        <span className="truncate">{nodeActionOpenLabel(action)}</span>
        {action ? <span className="shrink-0 text-xs text-muted-foreground">{nodeActionLabel(action)}</span> : null}
      </button>
      <button
        type="button"
        className="flex h-8 w-full min-w-0 items-center rounded px-2 text-left hover:bg-muted"
        onClick={() => {
          onEditNodeAction?.(node);
          onClose();
        }}
      >
        {action ? "编辑链接" : "添加链接"}
      </button>
    </div>
  );

  if (typeof document === "undefined") return menuElement;
  return createPortal(menuElement, document.body);
}
