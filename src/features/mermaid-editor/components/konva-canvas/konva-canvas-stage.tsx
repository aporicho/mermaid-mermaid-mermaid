import { Layer, Stage } from "react-konva";

import { AlignmentGuideOverlay, CanvasGrid } from "@/features/mermaid-editor/components/konva-canvas/canvas-overlays";
import { KonvaEdgeLayer, KonvaEdgeOverlayLayer } from "@/features/mermaid-editor/components/konva-canvas/edge-layer";
import { InlineEditOverlays } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { KonvaNodeLayer } from "@/features/mermaid-editor/components/konva-canvas/node-layer";
import { NodeActionTooltip, NodeContextMenu } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasSelectionToolbars } from "@/features/mermaid-editor/components/konva-canvas/canvas-selection-toolbars";
import { KonvaSubgraphLayer } from "@/features/mermaid-editor/components/konva-canvas/subgraph-layer";
import { normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import { cn } from "@/lib/utils";
import { resolveNodeEditorTypography } from "./resolve-node-editor-typography";
import type { KonvaCanvasStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage-types";
export type { KonvaCanvasStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage-types";

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
  specialNodeTokens,
  edgeLabelThemeTokens,
  typography,
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
  selectedTableCell,
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
  onSelectTableCell,
  onStartTableCellEdit,
  onStartTableHeaderEdit,
  onResizeTableColumn,
  onTableCellOperation,
  onInlineEditChange,
  onInlineEditCommit,
  onTablePaste
}: KonvaCanvasStageProps) {
  const nodeEditorTypography = resolveNodeEditorTypography(graph, inlineEdit, typography);
  const hoveredActionNode = hoveredNodeId ? graph.nodes.find((node) => node.id === hoveredNodeId) : undefined;
  const hoveredAction = normalizeNodeAction(hoveredActionNode?.action);
  const hoveredActionGeometry = hoveredActionNode ? nodeGeometryById.get(hoveredActionNode.id) : undefined;

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
                typography={typography.canvas.subgraphTitle}
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
              specialNodeTokens={specialNodeTokens}
              typography={typography}
              selectedTableCell={selectedTableCell}
              onStartNodeDrag={onStartNodeDrag}
              onMoveNode={onMoveNode}
              onEndDrag={onEndDrag}
              onCanvasClick={onCanvasClick}
              onCanvasDoubleClick={onCanvasDoubleClick}
              onNodeContextMenu={onNodeContextMenu}
              onNodeAnchorPointerDown={(event, hit, world) => onCanvasPointerDown(event, hit, world)}
              onOpenNodeAction={onOpenNodeAction}
              onRequestMarkdownDocumentPreview={onRequestMarkdownDocumentPreview}
              onSelectTableCell={onSelectTableCell}
              onStartTableCellEdit={onStartTableCellEdit}
              onStartTableHeaderEdit={onStartTableHeaderEdit}
              onResizeTableColumn={onResizeTableColumn}
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
        <CanvasSelectionToolbars
          graph={graph}
          selection={selection}
          mode={mode}
          manualLayout={dragEnabled}
          interactionKind={interactionState.kind}
          inlineEditing={Boolean(inlineEdit)}
          contextMenuOpen={Boolean(nodeContextMenu)}
          selectedNodeRects={selectedNodeRects}
          selectedTableCell={selectedTableCell}
          nodeGeometryById={nodeGeometryById}
          viewport={viewport}
          canvasSize={dimensions}
          onArrange={onArrangeNodes}
          onTableOperation={onTableCellOperation}
        />
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
          edgeLabelThemeTokens={edgeLabelThemeTokens}
          typography={typography.canvas}
          nodeEditorTypography={nodeEditorTypography}
          tableEditorTypography={typography.tableNode.cellEditor}
          tableTokens={specialNodeTokens.table}
          visualTokens={visualTokens}
          viewFilters={viewFilters}
          onChange={onInlineEditChange}
          onCommit={onInlineEditCommit}
          onTablePaste={onTablePaste}
        />
      </div>
    </section>
  );
}
