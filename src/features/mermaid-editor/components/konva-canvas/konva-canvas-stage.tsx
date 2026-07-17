import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { Layer, Stage } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { AlignmentGuideOverlay, CanvasGrid } from "@/features/mermaid-editor/components/konva-canvas/canvas-overlays";
import { KonvaEdgeLayer, KonvaEdgeOverlayLayer } from "@/features/mermaid-editor/components/konva-canvas/edge-layer";
import { InlineEditOverlays, type InlineEdit, type InlineEditStyle } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { KonvaNodeLayer } from "@/features/mermaid-editor/components/konva-canvas/node-layer";
import { NodeActionTooltip, NodeContextMenu } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import {
  SelectionArrangementToolbar,
  shouldShowSelectionArrangementToolbar
} from "@/features/mermaid-editor/components/konva-canvas/selection-arrangement-toolbar";
import { KonvaSubgraphLayer } from "@/features/mermaid-editor/components/konva-canvas/subgraph-layer";
import type { CanvasEdgeMotionVisual, CanvasNodeMotionVisual } from "@/features/mermaid-editor/components/konva-canvas/types";
import type { useKonvaNodeEditorLayout } from "@/features/mermaid-editor/components/konva-canvas/use-konva-inline-edit-session";
import type { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import type { AlignmentGuide, AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";
import type { CanvasGridSpec } from "@/features/mermaid-editor/lib/canvas-grid";
import type { CanvasPoint, HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasProximityScales } from "@/features/mermaid-editor/lib/canvas-motion";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { EdgeLabelGeometryTokens } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { CanvasNode, EditorMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import type { NodeGeometryTokens } from "@/features/mermaid-editor/lib/node-geometry";
import type { MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";
import type { NodeArrangementOperation } from "@/features/mermaid-editor/lib/node-arrangement";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { cn } from "@/lib/utils";

type RenderModel = ReturnType<typeof useKonvaRenderModel>;

export type KonvaCanvasStageProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<Konva.Stage | null>;
  dimensions: { width: number; height: number };
  viewport: ViewportState;
  cursorClassName: string;
  graph: MermaidGraph;
  selection: Selection;
  mode: EditorMode;
  panningRequested: boolean;
  dragEnabled: boolean;
  viewFilters: ViewFilters;
  inlineEdit: InlineEdit | null;
  interactionState: InteractionState;
  visualTokens: CanvasVisualTokens;
  gridSpec: CanvasGridSpec;
  nodeThemeTokens: NodeGeometryTokens;
  edgeLabelThemeTokens: EdgeLabelGeometryTokens;
  runtimeCreateScale: number;
  imageDisplaySrcBySrc: Record<string, string>;
  markdownDocumentPreviewByNodeId: Record<string, MarkdownDocumentPreview>;
  alignmentGuides: AlignmentGuide[];
  hoveredNodeId: string | null;
  hoveredSubgraphId: string | null;
  hoveredEdgeId: string | null;
  hoveredHitTarget: HitTarget;
  selectedSubgraphIds: RenderModel["selectedSubgraphIds"];
  selectedNodeRects: AlignmentRect[];
  scopedSubgraphGeometries: RenderModel["scopedSubgraphGeometries"];
  scopedVisibleEdges: RenderModel["scopedVisibleEdges"];
  scopedRenderedNodes: RenderModel["scopedRenderedNodes"];
  exitingNodes: CanvasNode[];
  nodeGeometryById: RenderModel["nodeGeometryById"];
  geometrySpec: RenderModel["geometrySpec"];
  edgeLabelSpec: RenderModel["edgeLabelSpec"];
  edgeMotion: Record<string, CanvasEdgeMotionVisual>;
  nodeMotion: Record<string, CanvasNodeMotionVisual>;
  nodeProximityScale: CanvasProximityScales;
  resolvedEdgeGeometry: RenderModel["resolvedEdgeGeometry"];
  selectedSingleEdge: RenderModel["selectedSingleEdge"];
  selectedSingleEdgeGeometry: RenderModel["selectedSingleEdgeGeometry"];
  selectionBox: RenderModel["selectionBox"];
  retargetDraft: RenderModel["retargetDraft"];
  connectionPreview: RenderModel["connectionPreview"];
  connectionDraftGeometry: RenderModel["connectionDraftGeometry"];
  connectionDraftVisual: RenderModel["connectionDraftVisual"];
  retargetPreview: RenderModel["retargetPreview"];
  retargetDraftGeometry: RenderModel["retargetDraftGeometry"];
  connectionTargetNodeId: string | null;
  connectionInvalidNodeId: string | null;
  connectionTargetSubgraphId: string | null;
  connectionInvalidSubgraphId: string | null;
  nodeContextMenu: { nodeId: string; x: number; y: number } | null;
  editStyle: InlineEditStyle | null;
  activeScale: number;
  nodeEditorLayout: ReturnType<typeof useKonvaNodeEditorLayout>;
  nodeEditorRef: RefObject<HTMLTextAreaElement | null>;
  nodeEditorMeasureRef: RefObject<HTMLDivElement | null>;
  onWheel: (event: KonvaEventObject<WheelEvent>) => void;
  onCanvasPointerDown: (event: KonvaEventObject<MouseEvent>, explicitHit?: HitTarget, worldOverride?: CanvasPoint) => void;
  onCanvasPointerMove: (event: KonvaEventObject<MouseEvent>) => void;
  onCanvasPointerUp: (event: KonvaEventObject<MouseEvent>) => void;
  onCanvasPointerLeave: () => void;
  onCanvasPointerTracking: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onCanvasTap: (event: KonvaEventObject<Event>, hit: HitTarget) => void;
  onCanvasDoubleClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onStartNodeDrag: (nodeId: string) => void;
  onStartSubgraphDrag: (subgraphId: string) => void;
  onMoveNode: (node: CanvasNode, target: Konva.Node) => void;
  onMoveSubgraph: (subgraphId: string, target: Konva.Node) => void;
  onEndDrag: () => void;
  onArrangeNodes: (operation: NodeArrangementOperation) => void;
  onNodeContextMenu: (event: KonvaEventObject<PointerEvent | MouseEvent>, node: CanvasNode) => void;
  onCloseNodeContextMenu: () => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onEditNodeAction?: (node: CanvasNode) => void;
  onRequestMarkdownDocumentPreview?: (node: CanvasNode) => void;
  onInlineEditChange: (next: InlineEdit) => void;
  onInlineEditCommit: (save: boolean) => void;
};

export function KonvaCanvasStage({
  containerRef,
  stageRef,
  dimensions,
  viewport,
  cursorClassName,
  graph,
  selection,
  mode,
  panningRequested,
  dragEnabled,
  viewFilters,
  inlineEdit,
  interactionState,
  visualTokens,
  gridSpec,
  nodeThemeTokens,
  edgeLabelThemeTokens,
  runtimeCreateScale,
  imageDisplaySrcBySrc,
  markdownDocumentPreviewByNodeId,
  alignmentGuides,
  hoveredNodeId,
  hoveredSubgraphId,
  hoveredEdgeId,
  hoveredHitTarget,
  selectedSubgraphIds,
  selectedNodeRects,
  scopedSubgraphGeometries,
  scopedVisibleEdges,
  scopedRenderedNodes,
  exitingNodes,
  nodeGeometryById,
  geometrySpec,
  edgeLabelSpec,
  edgeMotion,
  nodeMotion,
  nodeProximityScale,
  resolvedEdgeGeometry,
  selectedSingleEdge,
  selectedSingleEdgeGeometry,
  selectionBox,
  retargetDraft,
  connectionPreview,
  connectionDraftGeometry,
  connectionDraftVisual,
  retargetPreview,
  retargetDraftGeometry,
  connectionTargetNodeId,
  connectionInvalidNodeId,
  connectionTargetSubgraphId,
  connectionInvalidSubgraphId,
  nodeContextMenu,
  editStyle,
  activeScale,
  nodeEditorLayout,
  nodeEditorRef,
  nodeEditorMeasureRef,
  onWheel,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasPointerLeave,
  onCanvasPointerTracking,
  onCanvasClick,
  onCanvasTap,
  onCanvasDoubleClick,
  onStartNodeDrag,
  onStartSubgraphDrag,
  onMoveNode,
  onMoveSubgraph,
  onEndDrag,
  onArrangeNodes,
  onNodeContextMenu,
  onCloseNodeContextMenu,
  onOpenNodeAction,
  onEditNodeAction,
  onRequestMarkdownDocumentPreview,
  onInlineEditChange,
  onInlineEditCommit
}: KonvaCanvasStageProps) {
  const hoveredActionNode = hoveredNodeId ? graph.nodes.find((node) => node.id === hoveredNodeId) : undefined;
  const hoveredAction = normalizeNodeAction(hoveredActionNode?.action);
  const hoveredActionGeometry = hoveredActionNode ? nodeGeometryById.get(hoveredActionNode.id) : undefined;
  const showArrangementToolbar = shouldShowSelectionArrangementToolbar({
    selectedNodeCount: selectedNodeRects.length,
    mode,
    manualLayout: dragEnabled,
    interactionKind: interactionState.kind,
    inlineEditing: Boolean(inlineEdit),
    contextMenuOpen: Boolean(nodeContextMenu)
  });

  return (
    <section className="relative h-full min-h-0 bg-card">
      <div
        ref={containerRef}
        className={cn(
          "relative h-full min-h-0 touch-none overflow-hidden overscroll-none bg-background",
          cursorClassName
        )}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
        onPointerMove={onCanvasPointerTracking}
        onPointerLeave={onCanvasPointerLeave}
      >
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onWheel={onWheel}
          onMouseDown={onCanvasPointerDown}
          onMouseMove={onCanvasPointerMove}
          onMouseUp={onCanvasPointerUp}
          onMouseLeave={() => onCanvasPointerLeave()}
        >
          {viewFilters.grid ? <CanvasGrid dimensions={dimensions} viewport={viewport} visualTokens={visualTokens} gridSpec={gridSpec} /> : null}

          <Layer>
            {viewFilters.subgraphs ? (
              <KonvaSubgraphLayer
                graph={graph}
                mode={mode}
                panningRequested={panningRequested}
                dragEnabled={dragEnabled}
                inlineEdit={inlineEdit}
                interactionState={interactionState}
                scopedSubgraphGeometries={scopedSubgraphGeometries}
                selectedSubgraphIds={selectedSubgraphIds}
                hoveredSubgraphId={hoveredSubgraphId}
                connectionTargetSubgraphId={connectionTargetSubgraphId}
                connectionInvalidSubgraphId={connectionInvalidSubgraphId}
                connectionPreview={connectionPreview}
                retargetPreview={retargetPreview}
                visualTokens={visualTokens}
                nodeThemeTokens={nodeThemeTokens}
                onStartSubgraphDrag={onStartSubgraphDrag}
                onMoveSubgraph={onMoveSubgraph}
                onEndDrag={onEndDrag}
                onCanvasClick={onCanvasClick}
                onCanvasDoubleClick={onCanvasDoubleClick}
                onSubgraphAnchorPointerDown={(event, hit, world) => onCanvasPointerDown(event, hit, world)}
              />
            ) : null}

            <KonvaEdgeLayer
              viewFilters={viewFilters}
              selection={selection}
              hoveredEdgeId={hoveredEdgeId}
              interactionState={interactionState}
              inlineEdit={inlineEdit}
              visualTokens={visualTokens}
              edgeLabelThemeTokens={edgeLabelThemeTokens}
              edgeLabelSpec={edgeLabelSpec}
              edgeMotion={edgeMotion}
              scopedVisibleEdges={scopedVisibleEdges}
              resolvedEdgeGeometry={resolvedEdgeGeometry}
              retargetDraft={retargetDraft}
              retargetDraftGeometry={retargetDraftGeometry}
              retargetPreview={retargetPreview}
              onCanvasClick={onCanvasClick}
              onCanvasDoubleClick={onCanvasDoubleClick}
              onCanvasTap={onCanvasTap}
            />

            <KonvaNodeLayer
              viewFilters={viewFilters}
              mode={mode}
              panningRequested={panningRequested}
              dragEnabled={dragEnabled}
              selection={selection}
              inlineEdit={inlineEdit}
              interactionState={interactionState}
              hoveredNodeId={hoveredNodeId}
              connectionTargetNodeId={connectionTargetNodeId}
              connectionInvalidNodeId={connectionInvalidNodeId}
              connectionPreview={connectionPreview}
              retargetPreview={retargetPreview}
              scopedRenderedNodes={scopedRenderedNodes}
              exitingNodes={exitingNodes}
              nodeGeometryById={nodeGeometryById}
              geometrySpec={geometrySpec}
              nodeMotion={nodeMotion}
              nodeProximityScale={nodeProximityScale}
              imageDisplaySrcBySrc={imageDisplaySrcBySrc}
              markdownDocumentPreviewByNodeId={markdownDocumentPreviewByNodeId}
              runtimeCreateScale={runtimeCreateScale}
              visualTokens={visualTokens}
              nodeThemeTokens={nodeThemeTokens}
              onStartNodeDrag={onStartNodeDrag}
              onMoveNode={onMoveNode}
              onEndDrag={onEndDrag}
              onCanvasClick={onCanvasClick}
              onCanvasDoubleClick={onCanvasDoubleClick}
              onNodeContextMenu={onNodeContextMenu}
              onNodeAnchorPointerDown={(event, hit, world) => onCanvasPointerDown(event, hit, world)}
              onOpenNodeAction={onOpenNodeAction}
              onRequestMarkdownDocumentPreview={onRequestMarkdownDocumentPreview}
            />

            <KonvaEdgeOverlayLayer
              viewFilters={viewFilters}
              mode={mode}
              hoveredHitTarget={hoveredHitTarget}
              visualTokens={visualTokens}
              retargetDraft={retargetDraft}
              connectionDraftGeometry={connectionDraftGeometry}
              connectionDraftVisual={connectionDraftVisual}
              selectionBox={selectionBox}
              selectedSingleEdge={selectedSingleEdge}
              selectedSingleEdgeGeometry={selectedSingleEdgeGeometry}
              onEdgeEndpointPointerDown={(event, hit) => onCanvasPointerDown(event, hit)}
            />

            {alignmentGuides.length ? <AlignmentGuideOverlay guides={alignmentGuides} visualTokens={visualTokens} /> : null}
          </Layer>
        </Stage>
        {showArrangementToolbar ? (
          <SelectionArrangementToolbar
            rects={selectedNodeRects}
            viewport={viewport}
            canvasSize={dimensions}
            onArrange={onArrangeNodes}
          />
        ) : null}
        {nodeContextMenu ? (
          <NodeContextMenu
            menu={nodeContextMenu}
            node={graph.nodes.find((item) => item.id === nodeContextMenu.nodeId)}
            onClose={onCloseNodeContextMenu}
            onOpenNodeAction={onOpenNodeAction}
            onEditNodeAction={onEditNodeAction}
          />
        ) : null}
        {hoveredActionNode && hoveredAction && hoveredActionGeometry ? (
          <NodeActionTooltip node={hoveredActionNode} action={hoveredAction} geometry={hoveredActionGeometry} viewport={viewport} dimensions={dimensions} />
        ) : null}

        <InlineEditOverlays
          inlineEdit={inlineEdit}
          editStyle={editStyle}
          activeScale={activeScale}
          nodeEditorLayout={nodeEditorLayout}
          nodeEditorRef={nodeEditorRef}
          nodeEditorMeasureRef={nodeEditorMeasureRef}
          nodeThemeTokens={nodeThemeTokens}
          edgeLabelThemeTokens={edgeLabelThemeTokens}
          visualTokens={visualTokens}
          viewFilters={viewFilters}
          onChange={onInlineEditChange}
          onCommit={onInlineEditCommit}
        />
      </div>
    </section>
  );
}
