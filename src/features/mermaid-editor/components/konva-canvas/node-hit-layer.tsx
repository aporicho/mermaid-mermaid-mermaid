import { useEffect, useRef, type RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Shape } from "react-konva";

import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import type { CanvasDragPreviewStore } from "@/features/mermaid-editor/components/konva-canvas/canvas-drag-preview-store";
import { scaleLocalPointFromCenter } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import type { CanvasPoint, HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import {
  CANVAS_HIT_NAMES,
  nodeAnchorHitId,
  nodeHitId,
  nodeVisualId
} from "@/features/mermaid-editor/lib/canvas-hit-target";
import { centerScaleTransform, type CanvasNodePreviewPositions } from "@/features/mermaid-editor/lib/canvas-motion";
import { getAnchorVisualState, type CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, EditorMode, Selection } from "@/features/mermaid-editor/lib/editor-types";
import { flowchartPolygonPoints } from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { DEFAULT_FLOWCHART_NODE_SHAPE, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import { normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import { resolveCanvasNodeKind } from "@/features/mermaid-editor/lib/canvas-node-kind";

type RenderModel = ReturnType<typeof useKonvaRenderModel>;

type KonvaNodeHitLayerProps = {
  nodeLayerRef: RefObject<Konva.Layer | null>;
  interactionLayerRef: RefObject<Konva.Layer | null>;
  mode: EditorMode;
  panningRequested: boolean;
  dragEnabled: boolean;
  selection: Selection;
  inlineEdit: InlineEdit | null;
  interactionState: InteractionState;
  hoveredNodeId: string | null;
  connectionPreview: RenderModel["connectionPreview"];
  retargetPreview: RenderModel["retargetPreview"];
  scopedRenderedNodes: RenderModel["scopedRenderedNodes"];
  nodeGeometryById: RenderModel["nodeGeometryById"];
  nodeProximityScale: Record<string, number>;
  visualTokens: CanvasVisualTokens;
  dragPreviewStore: CanvasDragPreviewStore;
  onStartNodeDrag: (nodeId: string) => void;
  onMoveNode: (node: CanvasNode, target: Konva.Node) => CanvasNodePreviewPositions | null;
  onEndDrag: () => void;
  onCanvasClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onCanvasDoubleClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onNodeContextMenu: (event: KonvaEventObject<PointerEvent | MouseEvent>, node: CanvasNode) => void;
  onNodeAnchorPointerDown: (event: KonvaEventObject<MouseEvent>, hit: HitTarget, world: CanvasPoint) => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
};

export function KonvaNodeHitLayer({
  nodeLayerRef,
  interactionLayerRef,
  mode,
  panningRequested,
  dragEnabled,
  selection,
  inlineEdit,
  interactionState,
  hoveredNodeId,
  connectionPreview,
  retargetPreview,
  scopedRenderedNodes,
  nodeGeometryById,
  nodeProximityScale,
  visualTokens,
  dragPreviewStore,
  onStartNodeDrag,
  onMoveNode,
  onEndDrag,
  onCanvasClick,
  onCanvasDoubleClick,
  onNodeContextMenu,
  onNodeAnchorPointerDown,
  onOpenNodeAction
}: KonvaNodeHitLayerProps) {
  const promotedVisualsRef = useRef<PromotedVisual[]>([]);

  useEffect(() => () => restorePromotedVisuals(promotedVisualsRef.current), []);
  useEffect(() => dragPreviewStore.subscribe(() => {
    const snapshot = dragPreviewStore.getSnapshot();
    const interactionLayer = interactionLayerRef.current;
    const stage = interactionLayer?.getStage();
    if (!interactionLayer || !stage) return;
    if (!snapshot) {
      if (promotedVisualsRef.current.length === 0) return;
      restorePromotedVisuals(promotedVisualsRef.current);
      promotedVisualsRef.current = [];
      nodeLayerRef.current?.drawScene();
      interactionLayer.drawScene();
      return;
    }

    let nodeLayerChanged = false;
    for (const [id, position] of Object.entries(snapshot.nodePositions)) {
      let promoted = promotedVisualsRef.current.find((item) => item.id === id);
      if (!promoted) {
        const visual = stage.findOne((candidate: Konva.Node) => candidate.id() === nodeVisualId(id));
        const parent = visual?.getParent();
        if (visual && parent && parent !== interactionLayer) {
          promoted = { id, node: visual, parent, zIndex: visual.zIndex() };
          promotedVisualsRef.current.push(promoted);
          visual.moveTo(interactionLayer);
          nodeLayerChanged = true;
        }
      }
      promoted?.node.position(position);
      const hit = stage.findOne((candidate: Konva.Node) => candidate.id() === nodeHitId(id));
      hit?.position(position);
      if (hit?.getLayer() === nodeLayerRef.current) nodeLayerChanged = true;
    }
    if (nodeLayerChanged) nodeLayerRef.current?.drawScene();
    interactionLayer.drawScene();
  }), [dragPreviewStore, interactionLayerRef, nodeLayerRef]);

  function promoteDraggedVisuals(nodeId: string, target: Konva.Node) {
    restorePromotedVisuals(promotedVisualsRef.current);
    promotedVisualsRef.current = [];
    const interactionLayer = interactionLayerRef.current;
    const stage = target.getStage();
    if (!interactionLayer || !stage) return;
    const movingIds = selection.nodeIds.includes(nodeId) ? selection.nodeIds : [nodeId];
    const promoted = movingIds.flatMap((id) => {
      const visual = stage.findOne((candidate: Konva.Node) => candidate.id() === nodeVisualId(id));
      const parent = visual?.getParent();
      return visual && parent && parent !== interactionLayer
        ? [{ id, node: visual, parent, zIndex: visual.zIndex() }]
        : [];
    });
    for (const item of promoted) item.node.moveTo(interactionLayer);
    promotedVisualsRef.current = promoted;
    nodeLayerRef.current?.drawScene();
    interactionLayer.drawScene();
  }

  function movePromotedVisuals(positions: CanvasNodePreviewPositions | null) {
    if (!positions) return;
    for (const item of promotedVisualsRef.current) {
      const position = positions[item.id];
      if (position) item.node.position(position);
    }
    interactionLayerRef.current?.drawScene();
  }

  function finishDrag() {
    restorePromotedVisuals(promotedVisualsRef.current);
    promotedVisualsRef.current = [];
    nodeLayerRef.current?.drawScene();
    interactionLayerRef.current?.drawScene();
    onEndDrag();
  }

  return <>
    {scopedRenderedNodes.map((node) => {
      if (resolveCanvasNodeKind(node) === "table") return null;
      const geometry = nodeGeometryById.get(node.id);
      if (!geometry) return null;
      const proximityScale = nodeProximityScale[node.id] ?? 1;
      const transform = centerScaleTransform(geometry.frame);
      const anchorVisual = getAnchorVisualState({
        nodeId: node.id,
        mode,
        selection,
        hoveredNodeId,
        interactionState,
        inlineEdit,
        visualTokens
      });
      const connectionAnchorsVisible = nodeConnectionAnchorsVisible(node.id, connectionPreview, retargetPreview);
      const anchorsVisible = anchorVisual.visible || connectionAnchorsVisible;
      const action = normalizeNodeAction(node.action);
      const hasLinkCardAction = node.preview?.kind === "link-card";
      const badgeSize = visualTokens.actionBadge.size;
      const badgeX = hasLinkCardAction
        ? geometry.frame.width - 30
        : Math.max(visualTokens.actionBadge.insetX, geometry.frame.width - badgeSize - visualTokens.actionBadge.insetX);
      const badgeY = hasLinkCardAction ? 10 : visualTokens.actionBadge.insetY;

      return <Group
        id={nodeHitId(node.id)}
        name={CANVAS_HIT_NAMES.node}
        key={node.id}
        x={geometry.frame.x}
        y={geometry.frame.y}
        draggable={dragEnabled && mode === "select" && !panningRequested && interactionState.kind !== "panning"}
        onDragStart={(event) => {
          if (event.evt.button !== 0) {
            event.target.stopDrag();
            return;
          }
          onStartNodeDrag(node.id);
          promoteDraggedVisuals(node.id, event.target);
        }}
        onDragMove={(event) => movePromotedVisuals(onMoveNode(node, event.target))}
        onDragEnd={finishDrag}
        onClick={(event) => onCanvasClick(event, { kind: "node", id: node.id })}
        onDblClick={(event) => onCanvasDoubleClick(event, { kind: "node", id: node.id })}
        onContextMenu={(event) => onNodeContextMenu(event, node)}
      >
        <Group
          x={transform.x}
          y={transform.y}
          offsetX={transform.offsetX}
          offsetY={transform.offsetY}
          scaleX={proximityScale}
          scaleY={proximityScale}
        >
          <CanvasNodeHitShape node={node} width={geometry.frame.width} height={geometry.frame.height} />
          {hasLinkCardAction || action ? <SceneFreeHitRect
            x={badgeX}
            y={badgeY}
            width={badgeSize}
            height={badgeSize}
            onMouseDown={(event) => { event.cancelBubble = true; }}
            onClick={(event) => {
              event.cancelBubble = true;
              onOpenNodeAction?.(node);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              onOpenNodeAction?.(node);
            }}
          /> : null}
        </Group>
        {anchorsVisible ? geometry.anchorsLocal.map((anchor) => {
          const point = scaleLocalPointFromCenter(anchor, geometry.frame, proximityScale);
          return <SceneFreeHitCircle
            id={nodeAnchorHitId(node.id, anchor.key)}
            name={CANVAS_HIT_NAMES.nodeAnchor}
            key={`${node.id}-${anchor.key}`}
            x={point.x}
            y={point.y}
            radius={anchorVisual.radius}
            onMouseDown={(event) => {
              event.cancelBubble = true;
              onNodeAnchorPointerDown(event, { kind: "nodeAnchor", nodeId: node.id, anchor: anchor.key }, {
                x: geometry.frame.x + point.x,
                y: geometry.frame.y + point.y
              });
            }}
          />;
        }) : null}
      </Group>;
    })}
  </>;
}

function CanvasNodeHitShape({ node, width, height }: { node: CanvasNode; width: number; height: number }) {
  return <Shape
    width={width}
    height={height}
    fill="#000"
    sceneFunc={() => undefined}
    hitFunc={(context, shape) => {
      const normalizedShape = normalizeFlowchartShape(node.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
      const polygon = flowchartPolygonPoints(normalizedShape, { x: 0, y: 0, width, height });
      context.beginPath();
      if (normalizedShape === "circle" || normalizedShape === "sm-circ" || normalizedShape === "f-circ" || normalizedShape === "dbl-circ" || normalizedShape === "fr-circ" || normalizedShape === "cross-circ") {
        context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      } else if (polygon.length >= 3) {
        context.moveTo(polygon[0].x, polygon[0].y);
        for (const point of polygon.slice(1)) context.lineTo(point.x, point.y);
        context.closePath();
      } else {
        context.rect(0, 0, width, height);
      }
      context.fillStrokeShape(shape);
    }}
  />;
}

function SceneFreeHitRect(props: {
  id?: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onMouseDown?: (event: KonvaEventObject<MouseEvent>) => void;
  onClick?: (event: KonvaEventObject<MouseEvent>) => void;
  onTap?: (event: KonvaEventObject<Event>) => void;
}) {
  return <Shape
    {...props}
    fill="#000"
    sceneFunc={() => undefined}
    hitFunc={(context, shape) => {
      context.beginPath();
      context.rect(0, 0, props.width, props.height);
      context.fillStrokeShape(shape);
    }}
  />;
}

function SceneFreeHitCircle(props: {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  onMouseDown: (event: KonvaEventObject<MouseEvent>) => void;
}) {
  return <Shape
    {...props}
    fill="#000"
    sceneFunc={() => undefined}
    hitFunc={(context, shape) => {
      context.beginPath();
      context.arc(0, 0, props.radius, 0, Math.PI * 2);
      context.fillStrokeShape(shape);
    }}
  />;
}

type PromotedVisual = {
  id: string;
  node: Konva.Node;
  parent: Konva.Container;
  zIndex: number;
};

function restorePromotedVisuals(promoted: PromotedVisual[]) {
  for (const item of promoted) item.node.moveTo(item.parent);
  for (const item of [...promoted].sort((left, right) => left.zIndex - right.zIndex)) {
    item.node.zIndex(Math.min(item.zIndex, Math.max(0, item.parent.getChildren().length - 1)));
  }
}

function nodeConnectionAnchorsVisible(
  nodeId: string,
  connectionPreview: RenderModel["connectionPreview"],
  retargetPreview: RenderModel["retargetPreview"]
) {
  return connectionPreview?.targetNodeId === nodeId || connectionPreview?.invalidNodeId === nodeId
    || retargetPreview?.targetNodeId === nodeId || retargetPreview?.invalidNodeId === nodeId;
}
