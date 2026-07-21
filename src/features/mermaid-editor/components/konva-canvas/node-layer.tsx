import { Circle, Group, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { CanvasNodeActionBadge } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasNodeImageSurface } from "@/features/mermaid-editor/components/konva-canvas/node-image-surface";
import { CanvasNodeLinkCard } from "@/features/mermaid-editor/components/konva-canvas/node-link-card";
import { MarkdownDocumentCard } from "@/features/mermaid-editor/components/konva-canvas/markdown-document-card";
import { CanvasNodeShape } from "@/features/mermaid-editor/components/konva-canvas/node-shapes";
import { CanvasTableNode, CanvasTableNodePlaceholder } from "@/features/mermaid-editor/components/konva-canvas/table-node";
import { scaleLocalPointFromCenter } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { CanvasNodeMotionVisual } from "@/features/mermaid-editor/components/konva-canvas/types";
import type { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import type { CanvasPoint, HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import {
  CANVAS_HIT_NAMES,
  nodeAnchorHitId,
  nodeHitId
} from "@/features/mermaid-editor/lib/canvas-hit-target";
import { centerScaleTransform } from "@/features/mermaid-editor/lib/canvas-motion";
import {
  getAnchorVisualState,
  getNodeVisualState,
  resolveCanvasNodeTextFill,
  type CanvasVisualTokens
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, EditorMode, Selection } from "@/features/mermaid-editor/lib/editor-types";
import { normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import { normalizeImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import { normalizeCanvasNodePreview } from "@/features/mermaid-editor/lib/node-preview";
import type { MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";
import type { NodeGeometryTokens } from "@/features/mermaid-editor/lib/node-geometry";
import { buildNodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { EditorTypographyTokens, SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveCanvasNodeKind } from "@/features/mermaid-editor/lib/canvas-node-kind";
import type { TableCellSelection, TableHeaderSelection } from "@/features/mermaid-editor/lib/table-node";

type RenderModel = ReturnType<typeof useKonvaRenderModel>;

type KonvaNodeLayerProps = {
  viewFilters: ViewFilters;
  mode: EditorMode;
  panningRequested: boolean;
  dragEnabled: boolean;
  selection: Selection;
  inlineEdit: InlineEdit | null;
  interactionState: InteractionState;
  hoveredNodeId: string | null;
  connectionTargetNodeId: string | null;
  connectionInvalidNodeId: string | null;
  connectionPreview: RenderModel["connectionPreview"];
  retargetPreview: RenderModel["retargetPreview"];
  scopedRenderedNodes: RenderModel["scopedRenderedNodes"];
  exitingNodes: CanvasNode[];
  nodeGeometryById: RenderModel["nodeGeometryById"];
  geometrySpec: RenderModel["geometrySpec"];
  nodeMotion: Record<string, CanvasNodeMotionVisual>;
  nodeProximityScale: Record<string, number>;
  imageDisplaySrcBySrc: Record<string, string>;
  markdownDocumentPreviewByNodeId: Record<string, MarkdownDocumentPreview>;
  runtimeCreateScale: number;
  visualTokens: CanvasVisualTokens;
  nodeThemeTokens: NodeGeometryTokens;
  typography: EditorTypographyTokens;
  specialNodeTokens: SpecialNodeThemeTokens;
  selectedTableCell: TableCellSelection | null;
  onStartNodeDrag: (nodeId: string) => void;
  onMoveNode: (node: CanvasNode, target: Konva.Node) => void;
  onEndDrag: () => void;
  onCanvasClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onCanvasDoubleClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onNodeContextMenu: (event: KonvaEventObject<PointerEvent | MouseEvent>, node: CanvasNode) => void;
  onNodeAnchorPointerDown: (event: KonvaEventObject<MouseEvent>, hit: HitTarget, world: CanvasPoint) => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onRequestMarkdownDocumentPreview?: (node: CanvasNode) => void;
  onSelectTableCell: (selection: TableCellSelection | null) => void;
  onStartTableCellEdit: (selection: TableCellSelection) => void;
  onStartTableHeaderEdit: (selection: TableHeaderSelection) => void;
  onResizeTableColumn: (nodeId: string, columnId: string, width: number) => void;
};

export function KonvaNodeLayer({
  viewFilters,
  mode,
  panningRequested,
  dragEnabled,
  selection,
  inlineEdit,
  interactionState,
  hoveredNodeId,
  connectionTargetNodeId,
  connectionInvalidNodeId,
  connectionPreview,
  retargetPreview,
  scopedRenderedNodes,
  exitingNodes,
  nodeGeometryById,
  geometrySpec,
  nodeMotion,
  nodeProximityScale,
  imageDisplaySrcBySrc,
  markdownDocumentPreviewByNodeId,
  runtimeCreateScale,
  visualTokens,
  nodeThemeTokens,
  typography,
  specialNodeTokens,
  selectedTableCell,
  onStartNodeDrag,
  onMoveNode,
  onEndDrag,
  onCanvasClick,
  onCanvasDoubleClick,
  onNodeContextMenu,
  onNodeAnchorPointerDown,
  onOpenNodeAction,
  onRequestMarkdownDocumentPreview,
  onSelectTableCell,
  onStartTableCellEdit,
  onStartTableHeaderEdit,
  onResizeTableColumn
}: KonvaNodeLayerProps) {
  if (!viewFilters.nodes) return null;

  return (
    <>
      {scopedRenderedNodes.map((node) => {
        const geometry = nodeGeometryById.get(node.id);
        if (!geometry) return null;
        const motionVisual = nodeMotion[node.id];
        const nodeVisual = getNodeVisualState({
          nodeId: node.id,
          selection,
          hoveredNodeId,
          interactionState,
          connectionTargetNodeId,
          connectionInvalidNodeId,
          inlineEdit,
          visualTokens
        });
        const anchorVisual = getAnchorVisualState({ nodeId: node.id, mode, selection, hoveredNodeId, interactionState, inlineEdit, visualTokens });
        const connectionAnchorTarget = nodeConnectionAnchorTarget(node.id, connectionPreview, retargetPreview);
        const connectionAnchorsVisible = nodeConnectionAnchorsVisible(node.id, connectionPreview, retargetPreview);
        const nodeAnchorsVisible = anchorVisual.visible || connectionAnchorsVisible;
        const nodeKind = resolveCanvasNodeKind(node);
        const linkPreview = nodeKind === "link-card" ? normalizeCanvasNodePreview(node.preview) : undefined;
        const imageAsset = normalizeImageAsset(node.asset);
        const isMarkdownDocument = nodeKind === "markdown-document";
        const isImageNode = nodeKind === "image";
        const isTableNode = nodeKind === "table";
        const tableInteractive = mode === "select" && !panningRequested && interactionState.kind === "idle" && !inlineEdit;
        const isStandardNode = nodeKind === "standard";
        const nodeAction = isStandardNode && normalizeNodeAction(node.action);
        const imageDisplaySrc = imageAsset ? imageDisplaySrcBySrc[imageAsset.src] || imageAsset.src : undefined;
        const previewCoverSrc = linkPreview?.cover?.src ? imageDisplaySrcBySrc[linkPreview.cover.src] || linkPreview.cover.src : undefined;
        const nodeVisualTransform = centerScaleTransform(geometry.frame);
        const proximityScale = nodeProximityScale[node.id] ?? 1;
        const visualScale = (motionVisual?.scale ?? 1) * proximityScale;
        const nodeStrokeWidth = nodeVisual.strokeWidth + (motionVisual?.highlight ?? 0) * visualTokens.node.emphasizedStrokeWidth;
        const nodeTextFill = resolveCanvasNodeTextFill(node.fill, nodeVisual.textFill, visualTokens);
        const specialNodeStroke = nodeVisual.kind === "normal"
          ? specialNodeTokens.common.borderColor
          : nodeVisual.kind === "connectionTarget" || nodeVisual.kind === "connectionInvalid"
            ? nodeVisual.stroke
            : specialNodeTokens.common.accentColor;
        const specialNodeStrokeWidth = nodeVisual.kind === "normal" ? specialNodeTokens.common.borderWidth : nodeStrokeWidth;

        return (
          <Group
            id={nodeHitId(node.id)}
            name={CANVAS_HIT_NAMES.node}
            key={node.id}
            x={geometry.frame.x}
            y={geometry.frame.y}
            opacity={motionVisual?.opacity ?? 1}
            draggable={dragEnabled && mode === "select" && !panningRequested && interactionState.kind !== "panning"}
            onDragStart={(event) => {
              if (event.evt.button !== 0) {
                event.target.stopDrag();
                return;
              }
              onStartNodeDrag(node.id);
            }}
            onDragMove={(event) => onMoveNode(node, event.target)}
            onDragEnd={onEndDrag}
            onClick={(event) => onCanvasClick(event, { kind: "node", id: node.id })}
            onDblClick={(event) => onCanvasDoubleClick(event, { kind: "node", id: node.id })}
            onContextMenu={(event) => onNodeContextMenu(event, node)}
          >
            <Group
              x={nodeVisualTransform.x}
              y={nodeVisualTransform.y}
              offsetX={nodeVisualTransform.offsetX}
              offsetY={nodeVisualTransform.offsetY}
              scaleX={visualScale}
              scaleY={visualScale}
            >
              {isStandardNode ? (
                <CanvasNodeShape
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  stroke={nodeVisual.stroke}
                  strokeWidth={nodeStrokeWidth}
                  visualTokens={visualTokens}
                />
              ) : null}
              {isImageNode && imageDisplaySrc && geometry.imageBox ? (
                <CanvasNodeImageSurface
                  src={imageDisplaySrc}
                  width={geometry.imageBox.width}
                  height={geometry.imageBox.height}
                  specialNode={specialNodeTokens}
                  interacting={imageInteractionFrameVisible(nodeVisual.kind)}
                />
              ) : null}
              {isTableNode && geometry.table ? (
                <CanvasTableNode
                  nodeId={node.id}
                  layout={geometry.table}
                  selectedCell={selectedTableCell?.nodeId === node.id ? selectedTableCell : null}
                  specialNode={specialNodeTokens}
                  typography={typography.tableNode.cell}
                  editing={inlineEdit?.type === "tableCell" ? { nodeId: inlineEdit.id, rowId: inlineEdit.rowId, columnId: inlineEdit.columnId } : null}
                  editingHeader={inlineEdit?.type === "tableHeader" ? { nodeId: inlineEdit.id, columnId: inlineEdit.columnId } : null}
                  interactive={tableInteractive}
                  onCellClick={(event, cell) => {
                    event.cancelBubble = true;
                    onSelectTableCell(cell);
                    onCanvasClick(event, { kind: "tableCell", ...cell });
                  }}
                  onCellDoubleClick={(event, cell) => {
                    event.cancelBubble = true;
                    onSelectTableCell(cell);
                    onCanvasClick(event, { kind: "tableCell", ...cell });
                    onStartTableCellEdit(cell);
                  }}
                  onHeaderDoubleClick={(event, header) => {
                    onCanvasClick(event, { kind: "tableHeader", ...header });
                    onStartTableHeaderEdit(header);
                  }}
                  onResizeColumn={(columnId, width) => onResizeTableColumn(node.id, columnId, width)}
                />
              ) : null}
              {isTableNode && !geometry.table ? (
                <CanvasTableNodePlaceholder
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  label={node.label}
                  specialNode={specialNodeTokens}
                  typography={typography.tableNode.cell}
                  status={node.csvStatus === "error" ? "error" : "loading"}
                />
              ) : null}
              {linkPreview ? (
                <CanvasNodeLinkCard
                  node={node}
                  preview={linkPreview}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  coverSrc={previewCoverSrc}
                  stroke={specialNodeStroke}
                  strokeWidth={specialNodeStrokeWidth}
                  visualTokens={visualTokens}
                  typography={typography.linkCard}
                  actionTypography={typography.canvas.actionBadge}
                  specialNode={specialNodeTokens}
                  onOpen={() => onOpenNodeAction?.(node)}
                />
              ) : null}
              {isMarkdownDocument ? (
                <MarkdownDocumentCard
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  stroke={specialNodeStroke}
                  strokeWidth={specialNodeStrokeWidth}
                  typography={typography.markdownCard}
                  specialNode={specialNodeTokens}
                  preview={markdownDocumentPreviewByNodeId[node.id]}
                  onRequestPreview={onRequestMarkdownDocumentPreview}
                />
              ) : null}
              {isStandardNode ? (
                <Text
                  x={geometry.textBox.x}
                  y={geometry.textBox.y}
                  width={geometry.textBox.width}
                  height={geometry.textBox.height}
                  align="center"
                  verticalAlign="middle"
                  text={node.label}
                  fontSize={nodeThemeTokens.fontSize}
                  fontStyle={String(nodeThemeTokens.fontWeight)}
                  fontFamily={nodeThemeTokens.fontFamily}
                  lineHeight={nodeThemeTokens.lineHeight / nodeThemeTokens.fontSize}
                  letterSpacing={nodeThemeTokens.letterSpacing}
                  wrap="word"
                  fill={nodeTextFill}
                  ellipsis
                  visible={viewFilters.nodeLabels && !(inlineEdit?.type === "node" && inlineEdit.id === node.id)}
                />
              ) : null}
              {!isMarkdownDocument && nodeAction ? (
                <CanvasNodeActionBadge
                  actionKind={nodeAction.kind}
                  x={Math.max(8, geometry.frame.width - 24)}
                  y={6}
                  visualTokens={visualTokens}
                  typography={typography.canvas.actionBadge}
                  onOpen={() => onOpenNodeAction?.(node)}
                />
              ) : null}
            </Group>
            {nodeAnchorsVisible
              ? geometry.anchorsLocal.map((anchor) => {
                  const anchorPoint = scaleLocalPointFromCenter(anchor, geometry.frame, proximityScale);
                  return (
                    <Group
                      id={nodeAnchorHitId(node.id, anchor.key)}
                      name={CANVAS_HIT_NAMES.nodeAnchor}
                      key={`${node.id}-${anchor.key}`}
                      x={anchorPoint.x}
                      y={anchorPoint.y}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                        onNodeAnchorPointerDown(
                          event,
                          { kind: "nodeAnchor", nodeId: node.id, anchor: anchor.key },
                          {
                            x: geometry.frame.x + anchorPoint.x,
                            y: geometry.frame.y + anchorPoint.y
                          }
                        );
                      }}
                    >
                      <Circle radius={anchorVisual.radius} fill="rgba(0,0,0,0.001)" strokeEnabled={false} />
                      <Circle
                        radius={anchor.kind === "corner" ? anchorVisual.radius * visualTokens.subgraph.anchorCornerScale : anchorVisual.radius}
                        fill={anchor.key === connectionAnchorTarget ? visualTokens.colors.connection : anchorVisual.fill}
                        stroke={anchorVisual.stroke}
                        strokeWidth={anchorVisual.strokeWidth}
                        opacity={anchor.kind === "corner" ? visualTokens.subgraph.anchorCornerOpacity : 1}
                        listening={false}
                      />
                    </Group>
                  );
                })
              : null}
          </Group>
        );
      })}

      {exitingNodes.map((node) => {
        const geometry = buildNodeGeometry(node, geometrySpec);
        const motionVisual = nodeMotion[node.id] ?? { x: node.x, y: node.y, opacity: 0, scale: runtimeCreateScale, highlight: 0 };
        const nodeKind = resolveCanvasNodeKind(node);
        const linkPreview = nodeKind === "link-card" ? normalizeCanvasNodePreview(node.preview) : undefined;
        const imageAsset = normalizeImageAsset(node.asset);
        const isLinkCardNode = nodeKind === "link-card";
        const isMarkdownDocument = nodeKind === "markdown-document";
        const isImageNode = nodeKind === "image";
        const isTableNode = nodeKind === "table";
        const imageDisplaySrc = imageAsset ? imageDisplaySrcBySrc[imageAsset.src] || imageAsset.src : undefined;
        const previewCoverSrc = linkPreview?.cover?.src ? imageDisplaySrcBySrc[linkPreview.cover.src] || linkPreview.cover.src : undefined;
        const nodeVisualTransform = centerScaleTransform(geometry.frame);
        const nodeTextFill = resolveCanvasNodeTextFill(node.fill, visualTokens.colors.nodeText, visualTokens);

        return (
          <Group
            key={`exiting-${node.id}`}
            x={motionVisual.x}
            y={motionVisual.y}
            opacity={motionVisual.opacity}
            listening={false}
          >
            <Group
              x={nodeVisualTransform.x}
              y={nodeVisualTransform.y}
              offsetX={nodeVisualTransform.offsetX}
              offsetY={nodeVisualTransform.offsetY}
              scaleX={motionVisual.scale}
              scaleY={motionVisual.scale}
            >
              {!isImageNode && !isLinkCardNode && !isMarkdownDocument && !isTableNode ? (
                <CanvasNodeShape
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  stroke={visualTokens.colors.accent}
                  strokeWidth={
                    visualTokens.node.strokeWidth +
                    motionVisual.highlight * visualTokens.node.emphasizedStrokeWidth
                  }
                  visualTokens={visualTokens}
                />
              ) : null}
              {isImageNode && imageDisplaySrc && geometry.imageBox ? (
                <CanvasNodeImageSurface
                  src={imageDisplaySrc}
                  width={geometry.imageBox.width}
                  height={geometry.imageBox.height}
                  specialNode={specialNodeTokens}
                  interacting={false}
                />
              ) : null}
              {isTableNode && geometry.table ? (
                <CanvasTableNode
                  nodeId={node.id}
                  layout={geometry.table}
                  selectedCell={null}
                  specialNode={specialNodeTokens}
                  typography={typography.tableNode.cell}
                  editing={null}
                  editingHeader={null}
                  interactive={false}
                />
              ) : null}
              {isTableNode && !geometry.table ? (
                <CanvasTableNodePlaceholder
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  label={node.label}
                  specialNode={specialNodeTokens}
                  typography={typography.tableNode.cell}
                />
              ) : null}
              {linkPreview ? (
                <CanvasNodeLinkCard
                  node={node}
                  preview={linkPreview}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  coverSrc={previewCoverSrc}
                  stroke={specialNodeTokens.common.borderColor}
                  strokeWidth={specialNodeTokens.common.borderWidth}
                  visualTokens={visualTokens}
                  typography={typography.linkCard}
                  actionTypography={typography.canvas.actionBadge}
                  specialNode={specialNodeTokens}
                />
              ) : null}
              {isMarkdownDocument ? (
                <MarkdownDocumentCard
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  stroke={specialNodeTokens.common.borderColor}
                  strokeWidth={specialNodeTokens.common.borderWidth}
                  typography={typography.markdownCard}
                  specialNode={specialNodeTokens}
                  preview={markdownDocumentPreviewByNodeId[node.id]}
                />
              ) : null}
              {!isImageNode && !isLinkCardNode && !isMarkdownDocument && !isTableNode ? (
                <Text
                  x={geometry.textBox.x}
                  y={geometry.textBox.y}
                  width={geometry.textBox.width}
                  height={geometry.textBox.height}
                  align="center"
                  verticalAlign="middle"
                  text={node.label}
                  fontSize={nodeThemeTokens.fontSize}
                  fontStyle={String(nodeThemeTokens.fontWeight)}
                  fontFamily={nodeThemeTokens.fontFamily}
                  lineHeight={nodeThemeTokens.lineHeight / nodeThemeTokens.fontSize}
                  letterSpacing={nodeThemeTokens.letterSpacing}
                  wrap="word"
                  fill={nodeTextFill}
                  ellipsis
                  visible={viewFilters.nodeLabels}
                />
              ) : null}
            </Group>
          </Group>
        );
      })}
    </>
  );
}

function nodeConnectionAnchorTarget(
  nodeId: string,
  connectionPreview: RenderModel["connectionPreview"],
  retargetPreview: RenderModel["retargetPreview"]
) {
  if (connectionPreview?.targetNodeId === nodeId || connectionPreview?.invalidNodeId === nodeId) {
    return connectionPreview.targetAnchor;
  }
  if (retargetPreview?.targetNodeId === nodeId || retargetPreview?.invalidNodeId === nodeId) {
    return retargetPreview.targetAnchor;
  }
  return null;
}

function nodeConnectionAnchorsVisible(
  nodeId: string,
  connectionPreview: RenderModel["connectionPreview"],
  retargetPreview: RenderModel["retargetPreview"]
) {
  return (
    connectionPreview?.targetNodeId === nodeId ||
    connectionPreview?.invalidNodeId === nodeId ||
    retargetPreview?.targetNodeId === nodeId ||
    retargetPreview?.invalidNodeId === nodeId
  );
}

function imageInteractionFrameVisible(kind: ReturnType<typeof getNodeVisualState>["kind"]) {
  return kind !== "normal";
}
