import { useCallback, useRef } from "react";
import { Group, Text } from "react-konva";

import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { CanvasNodeActionBadge } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasNodeImageSurface } from "@/features/mermaid-editor/components/konva-canvas/node-image-surface";
import { CanvasNodeLinkCard } from "@/features/mermaid-editor/components/konva-canvas/node-link-card";
import { MarkdownDocumentCard } from "@/features/mermaid-editor/components/konva-canvas/markdown-document-card";
import { HtmlDocumentCard } from "@/features/mermaid-editor/components/konva-canvas/html-document-card";
import { CanvasNodeShape } from "@/features/mermaid-editor/components/konva-canvas/node-shapes";
import { CanvasTableNode, CanvasTableNodePlaceholder } from "@/features/mermaid-editor/components/konva-canvas/table-node";
import { CanvasStaticCacheGroup, canvasStaticCacheKey } from "@/features/mermaid-editor/components/konva-canvas/canvas-static-cache-group";
import type { CanvasNodeMotionVisual } from "@/features/mermaid-editor/components/konva-canvas/types";
import type { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import type { HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import { nodeVisualId } from "@/features/mermaid-editor/lib/canvas-hit-target";
import { centerScaleTransform } from "@/features/mermaid-editor/lib/canvas-motion";
import {
  getNodeVisualState,
  resolveCanvasNodeTextFill,
  type CanvasVisualTokens
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, Selection } from "@/features/mermaid-editor/lib/editor-types";
import { normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import { normalizeImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import type { MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";
import type { NodeGeometryTokens } from "@/features/mermaid-editor/lib/node-geometry";
import { buildNodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { EditorTypographyTokens, MarkdownThemeTokens, SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveCanvasNodeKind } from "@/features/mermaid-editor/lib/canvas-node-kind";
import type { TableCellSelection } from "@/features/mermaid-editor/lib/table-node";

type RenderModel = ReturnType<typeof useKonvaRenderModel>;

type KonvaNodeLayerProps = {
  viewFilters: ViewFilters;
  selection: Selection;
  inlineEdit: InlineEdit | null;
  interactionState: InteractionState;
  hoveredNodeId: string | null;
  hoveredHitTarget: HitTarget;
  connectionTargetNodeId: string | null;
  connectionInvalidNodeId: string | null;
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
  markdownTokens: MarkdownThemeTokens;
  fontRevision: number;
  specialNodeTokens: SpecialNodeThemeTokens;
  selectedTableCell: TableCellSelection | null;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onRequestMarkdownDocumentPreview?: (node: CanvasNode) => void;
};

export function KonvaNodeLayer({
  viewFilters,
  selection,
  inlineEdit,
  interactionState,
  hoveredNodeId,
  hoveredHitTarget,
  connectionTargetNodeId,
  connectionInvalidNodeId,
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
  markdownTokens,
  fontRevision,
  specialNodeTokens,
  selectedTableCell,
  onOpenNodeAction,
  onRequestMarkdownDocumentPreview,
}: KonvaNodeLayerProps) {
  const renderedNodesRef = useRef(scopedRenderedNodes);
  const openNodeActionRef = useRef(onOpenNodeAction);
  renderedNodesRef.current = scopedRenderedNodes;
  openNodeActionRef.current = onOpenNodeAction;
  const openLinkCardAction = useCallback((nodeId: string) => {
    const node = renderedNodesRef.current.find((candidate) => candidate.id === nodeId);
    if (node) openNodeActionRef.current?.(node);
  }, []);
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
        const nodeKind = resolveCanvasNodeKind(node);
        const linkPreview = nodeKind === "link-card" ? node.preview : undefined;
        const imageAsset = normalizeImageAsset(node.asset);
        const isMarkdownDocument = nodeKind === "markdown-document";
        const isHtmlDocument = nodeKind === "html-document";
        const isImageNode = nodeKind === "image";
        const isTableNode = nodeKind === "table";
        const isStandardNode = nodeKind === "standard";
        const nodeAction = isStandardNode && normalizeNodeAction(node.action);
        const nodeInlineEditing = inlineEdit?.type === "node" && inlineEdit.id === node.id;
        const staticNodeVisual = nodeVisual.kind === "dragging"
          ? nodeVisual
          : {
              ...nodeVisual,
              kind: "normal" as const,
              stroke: visualTokens.ordinaryNode.borderColor,
              strokeWidth: visualTokens.ordinaryNode.borderWidth,
              shadow: visualTokens.ordinaryNode.shadow
            };
        const imageDisplaySrc = imageAsset ? imageDisplaySrcBySrc[imageAsset.src] || imageAsset.src : undefined;
        const previewCoverSrc = linkPreview?.cover?.src ? imageDisplaySrcBySrc[linkPreview.cover.src] || linkPreview.cover.src : undefined;
        const nodeVisualTransform = centerScaleTransform(geometry.frame);
        const proximityScale = nodeProximityScale[node.id] ?? 1;
        const visualScale = (motionVisual?.scale ?? 1) * proximityScale;
        const nodeStrokeWidth = nodeVisual.strokeWidth + (motionVisual?.highlight ?? 0) * visualTokens.ordinaryNode.highlightBorderBoost;
        const nodeTextFill = resolveCanvasNodeTextFill(node.fill, nodeVisual.textFill, visualTokens);

        return (
          <Group
            id={nodeVisualId(node.id)}
            key={node.id}
            x={geometry.frame.x}
            y={geometry.frame.y}
            opacity={motionVisual?.opacity ?? 1}
            listening={false}
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
                <>
                  <CanvasStaticCacheGroup
                    cacheId={`${node.id}:standard-static`}
                    cacheKey={canvasStaticCacheKey(
                      node.label,
                      node.fill,
                      node.shape,
                      geometry.frame.width,
                      geometry.frame.height,
                      geometry.textBox.x,
                      geometry.textBox.y,
                      geometry.textBox.width,
                      geometry.textBox.height,
                      viewFilters.nodeLabels,
                      visualTokens.ordinaryNode,
                      nodeThemeTokens,
                      fontRevision
                    )}
                    cacheKind="standard"
                    cacheEnabled={standardNodeCacheEligible(node, nodeAction, visualTokens) && nodeVisual.kind !== "dragging" && !nodeInlineEditing}
                    cachePriority={1}
                  >
                    <CanvasNodeShape
                      node={node}
                      width={geometry.frame.width}
                      height={geometry.frame.height}
                      strokeWidth={staticNodeVisual.strokeWidth}
                      visualState={staticNodeVisual}
                      visualTokens={visualTokens}
                    />
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
                      visible={viewFilters.nodeLabels && !nodeInlineEditing}
                      listening={false}
                    />
                  </CanvasStaticCacheGroup>
                  {nodeVisual.kind !== "normal" && nodeVisual.kind !== "hovered" && nodeVisual.kind !== "dragging" ? (
                    <CanvasNodeShape
                      node={node}
                      width={geometry.frame.width}
                      height={geometry.frame.height}
                      strokeWidth={nodeStrokeWidth}
                      visualState={nodeVisual}
                      visualTokens={visualTokens}
                      paintMode="outline"
                    />
                  ) : null}
                  {nodeAction ? (
                    <CanvasNodeActionBadge
                      actionKind={nodeAction.kind}
                      x={Math.max(visualTokens.actionBadge.insetX, geometry.frame.width - visualTokens.actionBadge.size - visualTokens.actionBadge.insetX)}
                      y={visualTokens.actionBadge.insetY}
                      visualTokens={visualTokens}
                      typography={typography.canvas.actionBadge}
                      onOpen={() => onOpenNodeAction?.(node)}
                    />
                  ) : null}
                </>
              ) : null}
              {isImageNode && imageDisplaySrc && geometry.imageBox ? (
                <CanvasNodeImageSurface
                  src={imageDisplaySrc}
                  width={geometry.imageBox.width}
                  height={geometry.imageBox.height}
                  specialNode={specialNodeTokens}
                  interacting={imageInteractionFrameVisible(nodeVisual.kind)}
                  visualState={nodeVisual.kind}
                  nodeId={node.id}
                />
              ) : null}
              {isTableNode && geometry.table ? (
                <CanvasTableNode
                  nodeId={node.id}
                  layout={geometry.table}
                  selectedCell={selectedTableCell?.nodeId === node.id ? selectedTableCell : null}
                  hoveredCell={hoveredHitTarget.kind === "tableCell" && hoveredHitTarget.nodeId === node.id ? hoveredHitTarget : null}
                  specialNode={specialNodeTokens}
                  typography={typography.tableNode.cell}
                  editing={inlineEdit?.type === "tableCell" ? { nodeId: inlineEdit.id, rowId: inlineEdit.rowId, columnId: inlineEdit.columnId } : null}
                  editingHeader={inlineEdit?.type === "tableHeader" ? { nodeId: inlineEdit.id, columnId: inlineEdit.columnId } : null}
                  visualState={nodeVisual.kind}
                  fontRevision={fontRevision}
                />
              ) : null}
              {isTableNode && !geometry.table ? (
                <CanvasTableNodePlaceholder
                  nodeId={node.id}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  label={node.label}
                  specialNode={specialNodeTokens}
                  typography={typography.tableNode.cell}
                  fontRevision={fontRevision}
                  status={node.csvStatus === "error" ? "error" : "loading"}
                />
              ) : null}
              {linkPreview ? (
                <CanvasNodeLinkCard
                  nodeId={node.id}
                  label={node.label}
                  preview={linkPreview}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  coverSrc={previewCoverSrc}
                  visualTokens={visualTokens}
                  typography={typography.linkCard}
                  actionTypography={typography.canvas.actionBadge}
                  specialNode={specialNodeTokens}
                  visualState={nodeVisual.kind}
                  fontRevision={fontRevision}
                  onOpenNodeAction={openLinkCardAction}
                />
              ) : null}
              {isMarkdownDocument ? (
                <MarkdownDocumentCard
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  typography={typography.markdownCard}
                  markdownTokens={markdownTokens}
                  specialNode={specialNodeTokens}
                  visualState={nodeVisual.kind}
                  preview={markdownDocumentPreviewByNodeId[node.id]}
                  fontRevision={fontRevision}
                  onRequestPreview={onRequestMarkdownDocumentPreview}
                />
              ) : null}
              {isHtmlDocument ? (
                <HtmlDocumentCard
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  typography={typography.markdownCard}
                  specialNode={specialNodeTokens}
                  visualState={nodeVisual.kind}
                  fontRevision={fontRevision}
                />
              ) : null}
            </Group>
          </Group>
        );
      })}

      {exitingNodes.map((node) => {
        const geometry = buildNodeGeometry(node, geometrySpec);
        const motionVisual = nodeMotion[node.id] ?? { x: node.x, y: node.y, opacity: 0, scale: runtimeCreateScale, highlight: 0 };
        const nodeKind = resolveCanvasNodeKind(node);
        const linkPreview = nodeKind === "link-card" ? node.preview : undefined;
        const imageAsset = normalizeImageAsset(node.asset);
        const isLinkCardNode = nodeKind === "link-card";
        const isMarkdownDocument = nodeKind === "markdown-document";
        const isHtmlDocument = nodeKind === "html-document";
        const isImageNode = nodeKind === "image";
        const isTableNode = nodeKind === "table";
        const imageDisplaySrc = imageAsset ? imageDisplaySrcBySrc[imageAsset.src] || imageAsset.src : undefined;
        const previewCoverSrc = linkPreview?.cover?.src ? imageDisplaySrcBySrc[linkPreview.cover.src] || linkPreview.cover.src : undefined;
        const nodeVisualTransform = centerScaleTransform(geometry.frame);
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
        const nodeTextFill = resolveCanvasNodeTextFill(node.fill, visualTokens.ordinaryNode.textColor, visualTokens);

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
              {!isImageNode && !isLinkCardNode && !isMarkdownDocument && !isHtmlDocument && !isTableNode ? (
                <CanvasNodeShape
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  strokeWidth={
                    nodeVisual.strokeWidth +
                    motionVisual.highlight * visualTokens.ordinaryNode.highlightBorderBoost
                  }
                  visualState={nodeVisual}
                  visualTokens={visualTokens}
                />
              ) : null}
              {isImageNode && imageDisplaySrc && geometry.imageBox ? (
                <CanvasNodeImageSurface
                  src={imageDisplaySrc}
                  nodeId={node.id}
                  width={geometry.imageBox.width}
                  height={geometry.imageBox.height}
                  specialNode={specialNodeTokens}
                  interacting={false}
                  visualState={nodeVisual.kind}
                  cacheEnabled={false}
                />
              ) : null}
              {isTableNode && geometry.table ? (
                <CanvasTableNode
                  nodeId={node.id}
                  layout={geometry.table}
                  selectedCell={null}
                  hoveredCell={null}
                  specialNode={specialNodeTokens}
                  typography={typography.tableNode.cell}
                  editing={null}
                  editingHeader={null}
                  visualState={nodeVisual.kind}
                  fontRevision={fontRevision}
                  cacheEnabled={false}
                />
              ) : null}
              {isTableNode && !geometry.table ? (
                <CanvasTableNodePlaceholder
                  nodeId={node.id}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  label={node.label}
                  specialNode={specialNodeTokens}
                  typography={typography.tableNode.cell}
                  fontRevision={fontRevision}
                  cacheEnabled={false}
                />
              ) : null}
              {linkPreview ? (
                <CanvasNodeLinkCard
                  nodeId={node.id}
                  label={node.label}
                  preview={linkPreview}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  coverSrc={previewCoverSrc}
                  visualTokens={visualTokens}
                  typography={typography.linkCard}
                  actionTypography={typography.canvas.actionBadge}
                  specialNode={specialNodeTokens}
                  visualState={nodeVisual.kind}
                  fontRevision={fontRevision}
                  cacheEnabled={false}
                />
              ) : null}
              {isMarkdownDocument ? (
                <MarkdownDocumentCard
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  typography={typography.markdownCard}
                  markdownTokens={markdownTokens}
                  specialNode={specialNodeTokens}
                  visualState={nodeVisual.kind}
                  preview={markdownDocumentPreviewByNodeId[node.id]}
                  fontRevision={fontRevision}
                  cacheEnabled={false}
                />
              ) : null}
              {isHtmlDocument ? (
                <HtmlDocumentCard
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  typography={typography.markdownCard}
                  specialNode={specialNodeTokens}
                  visualState={nodeVisual.kind}
                  fontRevision={fontRevision}
                  cacheEnabled={false}
                />
              ) : null}
              {!isImageNode && !isLinkCardNode && !isMarkdownDocument && !isHtmlDocument && !isTableNode ? (
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
                  listening={false}
                />
              ) : null}
            </Group>
          </Group>
        );
      })}
    </>
  );
}

function imageInteractionFrameVisible(kind: ReturnType<typeof getNodeVisualState>["kind"]) {
  return kind !== "normal";
}

function standardNodeCacheEligible(
  node: CanvasNode,
  action: ReturnType<typeof normalizeNodeAction> | false,
  visualTokens: CanvasVisualTokens
) {
  const simpleShapes = new Set([undefined, "rect", "rounded", "circle", "stadium", "text"]);
  return Boolean(action)
    || visualTokens.ordinaryNode.shadow.opacity > 0
    || node.label.includes("\n")
    || node.label.length > visualTokens.ordinaryNode.maxChars
    || !simpleShapes.has(node.shape);
}
