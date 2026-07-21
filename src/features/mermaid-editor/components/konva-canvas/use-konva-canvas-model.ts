import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import type { Dispatch, SetStateAction } from "react";

import type { KonvaCanvasModelStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage-types";
import type { KonvaCanvasProps } from "@/features/mermaid-editor/components/konva-canvas/types";
import { useContainerSize } from "@/features/mermaid-editor/components/konva-canvas/use-container-size";
import { useKonvaDragDraft } from "@/features/mermaid-editor/components/konva-canvas/use-konva-drag-draft";
import { useKonvaDragMembership } from "@/features/mermaid-editor/components/konva-canvas/use-konva-drag-membership";
import {
  resolveKonvaInlineEditStyle,
  useKonvaInlineEditSession,
  useKonvaNodeEditorLayout
} from "@/features/mermaid-editor/components/konva-canvas/use-konva-inline-edit-session";
import { useKonvaHoverState } from "@/features/mermaid-editor/components/konva-canvas/use-konva-hover-state";
import { useKonvaMotion } from "@/features/mermaid-editor/components/konva-canvas/use-konva-motion";
import { useKonvaNodeProximity } from "@/features/mermaid-editor/components/konva-canvas/use-konva-node-proximity";
import { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import { useKonvaViewport } from "@/features/mermaid-editor/components/konva-canvas/use-konva-viewport";
import {
  idleInteraction,
  interactionCursor,
  selectionVersionKey,
  type BlankClickIntent,
  type InteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction";
import { DEFAULT_CANVAS_GRID, type CanvasGridSpec } from "@/features/mermaid-editor/lib/canvas-grid";
import { shouldRunCanvasProximity } from "@/features/mermaid-editor/lib/canvas-motion";
import { CANVAS_VISUAL_TOKENS } from "@/features/mermaid-editor/lib/canvas-visual-state";
import { DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/edge-label-geometry";
import { resolveRuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import { DEFAULT_NODE_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/node-geometry";
import { createDefaultEditorTypography, DEFAULT_EDITOR_THEME } from "@/features/mermaid-editor/lib/editor-theme";
import {
  SUBGRAPH_GEOMETRY_TOKENS,
  type SubgraphGeometryTokens
} from "@/features/mermaid-editor/lib/subgraph-geometry";
import { arrangeNodeRects, type NodeArrangementOperation } from "@/features/mermaid-editor/lib/node-arrangement";
import { useKonvaTableInteraction } from "@/features/mermaid-editor/components/konva-canvas/use-konva-table-interaction";

type UseKonvaCanvasModelArgs = KonvaCanvasProps & {
  mermaidEdgeRoutes: NonNullable<KonvaCanvasProps["mermaidEdgeRoutes"]>;
  imageDisplaySrcBySrc: NonNullable<KonvaCanvasProps["imageDisplaySrcBySrc"]>;
  visualTokens: NonNullable<KonvaCanvasProps["visualTokens"]>;
};

const DEFAULT_KONVA_TYPOGRAPHY = createDefaultEditorTypography();

export function useKonvaCanvasModel({
  graph,
  selection,
  viewport,
  mode,
  panningRequested,
  viewFilters,
  edgeRouting,
  mermaidEdgeRoutes,
  layoutMode,
  imageDisplaySrcBySrc,
  markdownDocumentPreviewByNodeId = {},
  visualTokens = CANVAS_VISUAL_TOKENS,
  geometryTokens,
  typography = DEFAULT_KONVA_TYPOGRAPHY,
  specialNodeTokens: specialNodeTokensProp,
  fontRevision = 0,
  motion: motionProp,
  onEditorCommand,
  onOpenNodeAction,
  onEditNodeAction,
  onRequestMarkdownDocumentPreview,
  onPointerWorldChange,
  onLiveStateChange
}: UseKonvaCanvasModelArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const runtimeMotion = useMemo(() => motionProp ?? resolveRuntimeEditorMotion(), [motionProp]);
  const blankClickIntentRef = useRef<BlankClickIntent | null>(null);
  const interactionGenerationRef = useRef(0);
  const selectionVersionRef = useRef(0);
  const lastSelectionKeyRef = useRef(selectionVersionKey(selection));
  const dimensions = useContainerSize(containerRef);
  const [interactionState, setInteractionState] = useState<InteractionState>(idleInteraction);
  const dragRuntime = useKonvaDragDraft({ onEditorCommand });
  const hoverState = useKonvaHoverState({ viewEdges: viewFilters.edges });
  const {
    hoveredNodeId,
    hoveredSubgraphId,
    hoveredEdgeId,
    hoveredHitTarget
  } = hoverState;
  const motion = useKonvaMotion({ graph, selection, interactionState, runtimeMotion });
  const {
    nodeMotion,
    edgeMotion,
    exitingNodes,
    stopActiveMotionTweens,
    clearNodeMotionVisual
  } = motion;
  const nodeThemeTokens = geometryTokens?.node ?? DEFAULT_NODE_GEOMETRY_TOKENS;
  const edgeLabelThemeTokens = geometryTokens?.edgeLabel ?? DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS;
  const subgraphThemeTokens: SubgraphGeometryTokens = geometryTokens?.subgraph ?? SUBGRAPH_GEOMETRY_TOKENS;
  const gridThemeTokens: CanvasGridSpec = geometryTokens?.grid ?? DEFAULT_CANVAS_GRID;
  const specialNodeTokens = specialNodeTokensProp ?? DEFAULT_EDITOR_THEME.specialNode;
  const tableInteraction = useKonvaTableInteraction({ graph, selection, specialNodeTokens, onEditorCommand });
  const { selectedTableCell, setSelectedTableCell } = tableInteraction;
  const inlineEditSession = useKonvaInlineEditSession({
    graph,
    selection,
    interactionState,
    mode,
    setInteractionState,
    invalidateBlankClickIntent,
    resetInteraction,
    onEditorCommand,
    selectedTableCell,
    setSelectedTableCell
  });
  const {
    inlineEdit,
    setInlineEdit,
    commitInlineEdit,
    nodeEditorRef,
    nodeEditorMeasureRef
  } = inlineEditSession;

  const dragEnabled = layoutMode === "manual";
  const viewportController = useKonvaViewport({
    containerRef,
    stageRef,
    dimensions,
    viewport,
    graph,
    selection,
    viewFilters,
    mode,
    edgeRouting,
    layoutMode,
    hoveredHitTarget,
    interactionState,
    onEditorCommand,
    onPointerWorldChange,
    invalidateBlankClickIntent
  });
  const proximity = useKonvaNodeProximity({ currentViewport: viewportController.currentViewport });
  const renderModel = useKonvaRenderModel({
    graph,
    selection,
    viewport,
    dimensions,
    viewFilters,
    edgeRouting,
    mermaidEdgeRoutes,
    layoutMode,
    inlineEdit,
    interactionState,
    hoveredNodeId,
    hoveredSubgraphId,
    hoveredEdgeId,
    dragPreviewPositions: dragRuntime.dragPreviewPositions,
    nodeMotion,
    nodeProximityScale: proximity.nodeProximityScale,
    nodeThemeTokens,
    specialNodeTokens,
    tableTypography: typography.tableNode.cell,
    fontRevision,
    edgeLabelThemeTokens,
    subgraphThemeTokens,
    visualTokens
  });
  const dragMembership = useKonvaDragMembership({
    dragRuntime,
    graph,
    selection,
    interactionState,
    selectedNodeIds: renderModel.selectedNodeIds,
    selectedSubgraphIds: renderModel.selectedSubgraphIds,
    dragEnabled,
    geometrySpec: renderModel.geometrySpec,
    subgraphGeometryById: renderModel.subgraphGeometryById,
    renderedSubgraphGeometries: renderModel.renderedSubgraphGeometries,
    subgraphThemeTokens,
    pointerScreenPoint: viewportController.pointerScreenPoint,
    pointerWorldPoint: viewportController.pointerWorldPoint,
    currentViewport: viewportController.currentViewport,
    setInteractionState,
    invalidateBlankClickIntent,
    resetInteraction,
    stopActiveMotionTweens,
    clearNodeMotionVisual,
    clearNodeProximityScales: proximity.clearNodeProximityScales,
    onEditorCommand
  });
  const nodeProximityInteractive = shouldRunCanvasProximity({
    reduced: runtimeMotion.reduced,
    viewNodes: viewFilters.nodes,
    panningRequested,
    inlineEditing: Boolean(inlineEdit),
    interactionKind: interactionState.kind,
    radiusPx: runtimeMotion.canvas.proximityRadiusPx,
    maxScale: runtimeMotion.canvas.proximityMaxScale,
    mode
  });
  proximity.syncNodeProximityRuntime({
    interactive: nodeProximityInteractive,
    frames: renderModel.renderedNodeGeometries.map((geometry) => ({ id: geometry.id, ...geometry.frame })),
    radiusPx: runtimeMotion.canvas.proximityRadiusPx,
    maxScale: runtimeMotion.canvas.proximityMaxScale,
    durationMs: runtimeMotion.canvas.proximityDuration * 1000
  });

  useEffect(() => {
    if (!nodeProximityInteractive) {
      proximity.clearNodeProximityScales(true, { preservePointer: true });
      return;
    }

    proximity.refreshNodeProximityScales();
    // Proximity helpers intentionally stay outside the dependency list; the listed
    // values define when the pointer-to-node distances must be recalculated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nodeProximityInteractive,
    renderModel.renderedNodeGeometries,
    runtimeMotion.canvas.proximityDuration,
    runtimeMotion.canvas.proximityMaxScale,
    runtimeMotion.canvas.proximityRadiusPx,
    viewport.scale,
    viewport.x,
    viewport.y
  ]);

  useEffect(() => {
    const nextSelectionKey = selectionVersionKey(selection);
    if (nextSelectionKey === lastSelectionKeyRef.current) return;

    lastSelectionKeyRef.current = nextSelectionKey;
    selectionVersionRef.current += 1;
    blankClickIntentRef.current = null;
    interactionGenerationRef.current += 1;
  }, [selection]);

  useEffect(() => {
    invalidateBlankClickIntent();
  }, [mode, panningRequested]);

  useEffect(() => {
    onLiveStateChange?.({
      canvasSize: dimensions,
      editing: inlineEdit ? { kind: inlineEdit.type === "tableCell" || inlineEdit.type === "tableHeader" ? "node" : inlineEdit.type, id: inlineEdit.id, draftText: inlineEdit.value } : null,
      interaction: interactionState.kind
    });
  }, [dimensions, inlineEdit, interactionState.kind, onLiveStateChange]);

  function invalidateBlankClickIntent() {
    blankClickIntentRef.current = null;
    interactionGenerationRef.current += 1;
  }

  function resetInteraction() {
    setInteractionState(idleInteraction);
  }

  const editStyle = resolveKonvaInlineEditStyle({
    inlineEdit,
    graph,
    viewFilters,
    nodeGeometryById: renderModel.nodeGeometryById,
    subgraphGeometryById: renderModel.subgraphGeometryById,
    currentViewport: viewportController.currentViewport,
    nodeProximityScale: proximity.nodeProximityScale,
    worldToScreen: viewportController.worldToScreen,
    resolvedEdgeGeometry: renderModel.resolvedEdgeGeometry,
    edgeLabelSpec: renderModel.edgeLabelSpec
  });
  const nodeEditorLayout = useKonvaNodeEditorLayout({
    inlineEdit,
    editStyle,
    nodeEditorMeasureRef,
    lineHeight: nodeThemeTokens.lineHeight
  });
  const activeScale = viewportController.currentViewport().scale;
  const cursorClassName = interactionCursor(mode, interactionState, panningRequested, hoveredHitTarget);

  function arrangeSelectedNodes(operation: NodeArrangementOperation) {
    onEditorCommand({
      type: "graph.arrangeNodes",
      operation,
      positions: arrangeNodeRects(renderModel.selectedNodeRects, operation),
      source: "menu"
    });
  }

  const stageProps: KonvaCanvasModelStageProps = {
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
    gridSpec: gridThemeTokens,
    nodeThemeTokens,
    specialNodeTokens,
    edgeLabelThemeTokens,
    typography,
    runtimeCreateScale: runtimeMotion.canvas.createScale,
    imageDisplaySrcBySrc,
    markdownDocumentPreviewByNodeId,
    alignmentGuides: dragMembership.alignmentGuides,
    hoveredNodeId,
    hoveredSubgraphId,
    hoveredEdgeId,
    hoveredHitTarget,
    selectedSubgraphIds: renderModel.selectedSubgraphIds,
    selectedNodeRects: renderModel.selectedNodeRects,
    scopedSubgraphGeometries: renderModel.scopedSubgraphGeometries,
    scopedVisibleEdges: renderModel.scopedVisibleEdges,
    scopedRenderedNodes: renderModel.scopedRenderedNodes,
    exitingNodes,
    nodeGeometryById: renderModel.nodeGeometryById,
    geometrySpec: renderModel.geometrySpec,
    edgeLabelSpec: renderModel.edgeLabelSpec,
    edgeMotion,
    nodeMotion,
    nodeProximityScale: proximity.nodeProximityScale,
    resolvedEdgeGeometry: renderModel.resolvedEdgeGeometry,
    selectedSingleEdge: renderModel.selectedSingleEdge,
    selectedSingleEdgeGeometry: renderModel.selectedSingleEdgeGeometry,
    selectionBox: renderModel.selectionBox,
    retargetDraft: renderModel.retargetDraft,
    connectionPreview: renderModel.connectionPreview,
    connectionDraftGeometry: renderModel.connectionDraftGeometry,
    connectionDraftVisual: renderModel.connectionDraftVisual,
    retargetPreview: renderModel.retargetPreview,
    retargetDraftGeometry: renderModel.retargetDraftGeometry,
    connectionTargetNodeId: renderModel.connectionTargetNodeId,
    connectionInvalidNodeId: renderModel.connectionInvalidNodeId,
    connectionTargetSubgraphId: renderModel.connectionTargetSubgraphId,
    connectionInvalidSubgraphId: renderModel.connectionInvalidSubgraphId,
    editStyle,
    activeScale,
    nodeEditorLayout,
    nodeEditorRef,
    nodeEditorMeasureRef,
    selectedTableCell,
    onWheel: viewportController.onWheel,
    onMoveNode: dragMembership.moveSelectedNodes,
    onMoveSubgraph: dragMembership.moveSelectedSubgraphs,
    onEndDrag: dragMembership.finishKonvaDrag,
    onArrangeNodes: arrangeSelectedNodes,
    onOpenNodeAction,
    onEditNodeAction,
    onRequestMarkdownDocumentPreview,
    onSelectTableCell: setSelectedTableCell,
    onStartTableCellEdit: inlineEditSession.startTableCellEdit,
    onStartTableHeaderEdit: inlineEditSession.startTableHeaderEdit,
    onResizeTableColumn: tableInteraction.resizeColumn,
    onTableCellOperation: tableInteraction.applyOperation,
    onInlineEditChange: setInlineEdit,
    onInlineEditCommit: commitInlineEdit,
    onTablePaste: inlineEditSession.pasteTableCells
  };

  return {
    graph,
    selection,
    viewport,
    mode,
    panningRequested,
    viewFilters,
    edgeRouting,
    layoutMode,
    visualTokens,
    dimensions,
    interactionState,
    setInteractionState: setInteractionState as Dispatch<SetStateAction<InteractionState>>,
    inlineEdit,
    dragEnabled,
    nodeProximityInteractive,
    selectedNodeIds: renderModel.selectedNodeIds,
    geometrySpec: renderModel.geometrySpec,
    renderedNodeGeometries: renderModel.renderedNodeGeometries,
    renderedSubgraphGeometries: renderModel.renderedSubgraphGeometries,
    subgraphGeometryById: renderModel.subgraphGeometryById,
    connectionAnchorSnapRadiusWorld: renderModel.connectionAnchorSnapRadiusWorld,
    startInlineEdit: inlineEditSession.startInlineEdit,
    startNodeDrag: dragMembership.startNodeDrag,
    startSubgraphDrag: dragMembership.startSubgraphDrag,
    clearAlignmentGuides: dragMembership.clearAlignmentGuides,
    resetInteraction,
    invalidateBlankClickIntent,
    blankClickIntentRef,
    interactionGenerationRef,
    selectionVersionRef,
    hoverState,
    viewportController,
    proximity,
    stageProps
  };
}

export type KonvaCanvasModel = ReturnType<typeof useKonvaCanvasModel>;
