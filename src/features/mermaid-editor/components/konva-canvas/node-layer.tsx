import { Circle, Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { CanvasNodeActionBadge } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasNodeImage } from "@/features/mermaid-editor/components/konva-canvas/node-image";
import { CanvasNodeLinkCard } from "@/features/mermaid-editor/components/konva-canvas/node-link-card";
import { MarkdownDocumentCard } from "@/features/mermaid-editor/components/konva-canvas/markdown-document-card";
import { CanvasNodeShape } from "@/features/mermaid-editor/components/konva-canvas/node-shapes";
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
  type CanvasVisualTokens
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, EditorMode, Selection } from "@/features/mermaid-editor/lib/editor-types";
import { normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import { normalizeImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import { normalizeCanvasNodePreview } from "@/features/mermaid-editor/lib/node-preview";
import { isMarkdownDocumentNode, type MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";
import type { NodeGeometryTokens } from "@/features/mermaid-editor/lib/node-geometry";
import { buildNodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";

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
  onStartNodeDrag: (nodeId: string) => void;
  onMoveNode: (node: CanvasNode, target: Konva.Node) => void;
  onEndDrag: () => void;
  onCanvasClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onCanvasDoubleClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onNodeContextMenu: (event: KonvaEventObject<PointerEvent | MouseEvent>, node: CanvasNode) => void;
  onNodeAnchorPointerDown: (event: KonvaEventObject<MouseEvent>, hit: HitTarget, world: CanvasPoint) => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onRequestMarkdownDocumentPreview?: (node: CanvasNode) => void;
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
  onStartNodeDrag,
  onMoveNode,
  onEndDrag,
  onCanvasClick,
  onCanvasDoubleClick,
  onNodeContextMenu,
  onNodeAnchorPointerDown,
  onOpenNodeAction,
  onRequestMarkdownDocumentPreview
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
        const linkPreview = normalizeCanvasNodePreview(node.preview);
        const imageAsset = normalizeImageAsset(node.asset);
        const isLinkCardNode = Boolean(linkPreview);
        const isMarkdownDocument = isMarkdownDocumentNode(node);
        const isImageNode = Boolean(imageAsset) && !isLinkCardNode && !isMarkdownDocument;
        const isStandardNode = !isImageNode && !isLinkCardNode ? !isMarkdownDocument : false;
        const nodeAction = !isImageNode && !isLinkCardNode && normalizeNodeAction(node.action);
        const imageDisplaySrc = imageAsset ? imageDisplaySrcBySrc[imageAsset.src] || imageAsset.src : undefined;
        const previewCoverSrc = linkPreview?.cover?.src ? imageDisplaySrcBySrc[linkPreview.cover.src] || linkPreview.cover.src : undefined;
        const nodeVisualTransform = centerScaleTransform(geometry.frame);
        const proximityScale = nodeProximityScale[node.id] ?? 1;
        const visualScale = (motionVisual?.scale ?? 1) * proximityScale;
        const nodeStrokeWidth = nodeVisual.strokeWidth + (motionVisual?.highlight ?? 0) * visualTokens.node.emphasizedStrokeWidth;

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
              {!isImageNode && !isLinkCardNode ? (
                !isMarkdownDocument ? (
                  <CanvasNodeShape
                    node={node}
                    width={geometry.frame.width}
                    height={geometry.frame.height}
                    stroke={nodeVisual.stroke}
                    strokeWidth={nodeStrokeWidth}
                    visualTokens={visualTokens}
                  />
                ) : null
              ) : null}
              {isImageNode ? (
                <Rect
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  fill="rgba(0,0,0,0.001)"
                  strokeEnabled={false}
                />
              ) : null}
              {isImageNode && imageDisplaySrc && geometry.imageBox ? (
                <CanvasNodeImage
                  src={imageDisplaySrc}
                  x={geometry.imageBox.x}
                  y={geometry.imageBox.y}
                  width={geometry.imageBox.width}
                  height={geometry.imageBox.height}
                />
              ) : null}
              {isImageNode && imageInteractionFrameVisible(nodeVisual.kind) ? (
                <Rect
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  fillEnabled={false}
                  stroke={nodeVisual.stroke}
                  strokeWidth={nodeStrokeWidth}
                  cornerRadius={0}
                  listening={false}
                />
              ) : null}
              {linkPreview ? (
                <CanvasNodeLinkCard
                  node={node}
                  preview={linkPreview}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  coverSrc={previewCoverSrc}
                  stroke={nodeVisual.stroke}
                  strokeWidth={nodeStrokeWidth}
                  visualTokens={visualTokens}
                  onOpen={() => onOpenNodeAction?.(node)}
                />
              ) : null}
              {isMarkdownDocument ? (
                <MarkdownDocumentCard
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  stroke={nodeVisual.stroke}
                  strokeWidth={nodeStrokeWidth}
                  textFill={nodeVisual.textFill}
                  visualTokens={visualTokens}
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
                  wrap="word"
                  fill={nodeVisual.textFill}
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
        const linkPreview = normalizeCanvasNodePreview(node.preview);
        const imageAsset = normalizeImageAsset(node.asset);
        const isLinkCardNode = Boolean(linkPreview);
        const isMarkdownDocument = isMarkdownDocumentNode(node);
        const isImageNode = Boolean(imageAsset) && !isLinkCardNode && !isMarkdownDocument;
        const imageDisplaySrc = imageAsset ? imageDisplaySrcBySrc[imageAsset.src] || imageAsset.src : undefined;
        const previewCoverSrc = linkPreview?.cover?.src ? imageDisplaySrcBySrc[linkPreview.cover.src] || linkPreview.cover.src : undefined;
        const nodeVisualTransform = centerScaleTransform(geometry.frame);

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
              {!isImageNode && !isLinkCardNode && !isMarkdownDocument ? (
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
                <CanvasNodeImage
                  src={imageDisplaySrc}
                  x={geometry.imageBox.x}
                  y={geometry.imageBox.y}
                  width={geometry.imageBox.width}
                  height={geometry.imageBox.height}
                />
              ) : null}
              {linkPreview ? (
                <CanvasNodeLinkCard
                  node={node}
                  preview={linkPreview}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  coverSrc={previewCoverSrc}
                  stroke={visualTokens.colors.accent}
                  strokeWidth={visualTokens.node.strokeWidth + motionVisual.highlight * visualTokens.node.emphasizedStrokeWidth}
                  visualTokens={visualTokens}
                />
              ) : null}
              {isMarkdownDocument ? (
                <MarkdownDocumentCard
                  node={node}
                  width={geometry.frame.width}
                  height={geometry.frame.height}
                  stroke={visualTokens.colors.accent}
                  strokeWidth={visualTokens.node.strokeWidth + motionVisual.highlight * visualTokens.node.emphasizedStrokeWidth}
                  textFill={visualTokens.colors.nodeText}
                  visualTokens={visualTokens}
                  preview={markdownDocumentPreviewByNodeId[node.id]}
                />
              ) : null}
              {!isImageNode && !isLinkCardNode && !isMarkdownDocument ? (
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
                  wrap="word"
                  fill={visualTokens.colors.nodeText}
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
