import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Layer, Stage } from "react-konva";
import { Konva } from "konva/lib/Global";
import type KonvaTypes from "konva";

import { CanvasGrid } from "@/features/mermaid-editor/components/konva-canvas/canvas-overlays";
import { KonvaEdgeLayer } from "@/features/mermaid-editor/components/konva-canvas/edge-layer";
import { InlineEditOverlays } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { KonvaNodeLayer } from "@/features/mermaid-editor/components/konva-canvas/node-layer";
import { KonvaInteractionLayerContent } from "@/features/mermaid-editor/components/konva-canvas/interaction-layer-content";
import { NodeActionTooltip, NodeContextMenu } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasSelectionToolbars } from "@/features/mermaid-editor/components/konva-canvas/canvas-selection-toolbars";
import { KonvaSubgraphLayer } from "@/features/mermaid-editor/components/konva-canvas/subgraph-layer";
import { nodeActionTooltipEnabled, normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import { cn } from "@/lib/utils";
import { resolveNodeEditorTypography } from "./resolve-node-editor-typography";
import type { KonvaCanvasStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage-types";
import { canvasPixelRatio } from "@/features/mermaid-editor/lib/canvas-render-quality";
import { recordPerformanceMetric } from "@/features/mermaid-editor/lib/editor-performance";
import { CanvasNodeTextureCacheProvider } from "@/features/mermaid-editor/components/konva-canvas/canvas-static-cache-group";
export type { KonvaCanvasStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage-types";

Konva.pixelRatio = canvasPixelRatio(globalThis.devicePixelRatio);
Konva.autoDrawEnabled = false;

export function KonvaCanvasStage(stageProps: KonvaCanvasStageProps) {
  const {
  containerRef,
  stageRef,
  dimensions,
  viewport,
  liveViewport,
  viewportSurface,
  viewportCompositor,
  cursorClassName,
  graph,
  selection,
  mode,
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
  markdownTokens,
  fontRevision,
  nodeTextureCacheController,
  runtimeCreateScale,
  imageDisplaySrcBySrc,
  markdownDocumentPreviewByNodeId,
  textDocumentPreviewByNodeId,
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
  onCanvasPointerCancel,
  onCanvasLostPointerCapture,
  onCanvasClick,
  onCanvasDoubleClick,
  onArrangeNodes,
  onCanvasContextMenu,
  onCloseNodeContextMenu,
  onOpenNodeAction,
  onEditNodeAction,
  onRequestMarkdownDocumentPreview,
  onRequestTextDocumentPreview,
  onTableCellOperation,
  onInlineEditChange,
  onInlineEditCommit,
  onTablePaste
  } = stageProps;
  const backgroundLayerRef = useRef<KonvaTypes.Layer | null>(null);
  const sceneLayerRef = useRef<KonvaTypes.Layer | null>(null);
  const interactionLayerRef = useRef<KonvaTypes.Layer | null>(null);
  const rebaseGuardRef = useRef<HTMLCanvasElement | null>(null);
  const contentDrawStartedAtRef = useRef(0);
  const nodeEditorTypography = resolveNodeEditorTypography(graph, inlineEdit, typography);
  const hoveredActionNode = hoveredNodeId ? graph.nodes.find((node) => node.id === hoveredNodeId) : undefined;
  const hoveredActionCandidate = normalizeNodeAction(hoveredActionNode?.action);
  const hoveredAction = nodeActionTooltipEnabled(hoveredActionCandidate) ? hoveredActionCandidate : undefined;
  const hoveredActionGeometry = hoveredActionNode ? nodeGeometryById.get(hoveredActionNode.id) : undefined;
  const linkCardDrawStats = useMemo(() => {
    let cards = 0;
    let sourcePixels = 0;
    for (const node of scopedRenderedNodes) {
      if (node.preview?.kind !== "link-card") continue;
      cards += 1;
      const width = node.preview.cover?.width;
      const height = node.preview.cover?.height;
      if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0) sourcePixels += width * height;
    }
    return { cards, sourcePixels };
  }, [scopedRenderedNodes]);
  const sceneScopeKey = useMemo(() => [
    scopedRenderedNodes.map((node) => node.id).join(","),
    scopedVisibleEdges.map((edge) => edge.id).join(","),
    scopedSubgraphGeometries.map((subgraph) => subgraph.id).join(",")
  ].join("|"), [scopedRenderedNodes, scopedSubgraphGeometries, scopedVisibleEdges]);
  const stableSceneRevision = useSceneRevision([
    edgeLabelThemeTokens, edgeMotion, exitingNodes, fontRevision, graph, gridSpec,
    imageDisplaySrcBySrc, inlineEdit, markdownDocumentPreviewByNodeId, textDocumentPreviewByNodeId, markdownTokens,
    nodeMotion, nodeThemeTokens, runtimeCreateScale, sceneScopeKey, selection,
    specialNodeTokens, typography, viewFilters, visualTokens, hoveredEdgeId,
    viewport.scale, viewport.x, viewport.y
  ]);

  useEffect(() => {
    const layer = sceneLayerRef.current;
    if (!layer) return;
    const handleBeforeDraw = () => {
      contentDrawStartedAtRef.current = performance.now();
    };
    const handleAfterDraw = () => {
      if (!contentDrawStartedAtRef.current) return;
      recordPerformanceMetric("canvas-content-draw", performance.now() - contentDrawStartedAtRef.current, {
        nodes: scopedRenderedNodes.length,
        edges: scopedVisibleEdges.length,
        subgraphs: scopedSubgraphGeometries.length,
        linkCards: linkCardDrawStats.cards,
        linkCardSourcePixels: linkCardDrawStats.sourcePixels
      });
      contentDrawStartedAtRef.current = 0;
    };
    layer.on("beforeDraw", handleBeforeDraw);
    layer.on("afterDraw", handleAfterDraw);
    return () => {
      layer.off("beforeDraw", handleBeforeDraw);
      layer.off("afterDraw", handleAfterDraw);
    };
  }, [linkCardDrawStats, scopedRenderedNodes.length, scopedSubgraphGeometries.length, scopedVisibleEdges.length]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const sceneLayer = sceneLayerRef.current;
    const activeLayer = interactionLayerRef.current;
    if (!stage || !sceneLayer || !activeLayer) return;
    viewportCompositor.configureSurface(viewportSurface);
    viewportCompositor.attach({
      stage,
      backgroundLayer: backgroundLayerRef.current,
      sceneLayer,
      activeLayer,
      rebaseGuardCanvas: rebaseGuardRef.current
    });
    nodeTextureCacheController.setVisualInvalidationListener((layer, reason) => {
      viewportCompositor.invalidateLayer(layer, reason);
    });
    return () => {
      nodeTextureCacheController.setVisualInvalidationListener(() => undefined);
      viewportCompositor.detach();
    };
  }, [nodeTextureCacheController, stageRef, viewportCompositor, viewportSurface]);

  useLayoutEffect(() => {
    viewportCompositor.commitScene(viewport, "react");
  }, [stableSceneRevision, viewport, viewportCompositor]);

  const surfaceViewport = useMemo(() => ({
    x: viewportSurface.padding + viewport.x,
    y: viewportSurface.padding + viewport.y,
    scale: viewport.scale
  }), [viewport.scale, viewport.x, viewport.y, viewportSurface.padding]);
  const preventNativeContextMenu = onCanvasContextMenu;
  const invalidateScene = useCallback((reason: string) => viewportCompositor.invalidateScene(reason), [viewportCompositor]);

  return (
    <section className="relative h-full min-h-0 bg-card">
      <div
        ref={containerRef}
        data-canvas-input-surface
        className={cn(
          "relative h-full min-h-0 touch-none overflow-hidden overscroll-none bg-background",
          cursorClassName
        )}
        onAuxClick={(event) => event.preventDefault()}
        onWheel={onWheel}
        onContextMenu={preventNativeContextMenu}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerCancel}
        onLostPointerCapture={onCanvasLostPointerCapture}
        onPointerLeave={onCanvasPointerLeave}
        onClick={onCanvasClick}
        onDoubleClick={onCanvasDoubleClick}
      >
        <div
          className="pointer-events-none absolute"
          style={{ left: -viewportSurface.padding, top: -viewportSurface.padding }}
        >
        <Stage
          ref={stageRef}
          width={viewportSurface.width}
          height={viewportSurface.height}
          x={surfaceViewport.x}
          y={surfaceViewport.y}
          scaleX={surfaceViewport.scale}
          scaleY={surfaceViewport.scale}
          listening={false}
        >
          <Layer ref={backgroundLayerRef} name="canvas-background-layer" imageSmoothingEnabled listening={false}>
            {viewFilters.grid ? (
              <CanvasGrid
                dimensions={{ width: viewportSurface.width, height: viewportSurface.height }}
                viewport={surfaceViewport}
                visualTokens={visualTokens}
                gridSpec={gridSpec}
              />
            ) : null}
          </Layer>

          <Layer ref={sceneLayerRef} name="canvas-scene-layer" imageSmoothingEnabled listening={false}>
            {viewFilters.subgraphs ? (
              <KonvaSubgraphLayer
                graph={graph}
                inlineEdit={inlineEdit}
                scopedSubgraphGeometries={scopedSubgraphGeometries}
                selectedSubgraphIds={selectedSubgraphIds}
                hoveredSubgraphId={hoveredSubgraphId}
                connectionTargetSubgraphId={connectionTargetSubgraphId}
                connectionInvalidSubgraphId={connectionInvalidSubgraphId}
                visualTokens={visualTokens}
                typography={typography.canvas.subgraphTitle}
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
            />
            <CanvasNodeTextureCacheProvider controller={nodeTextureCacheController} onInvalidateScene={invalidateScene}>
              <KonvaNodeLayer
                viewFilters={viewFilters}
                selection={selection}
                inlineEdit={inlineEdit}
                interactionState={interactionState}
                hoveredNodeId={hoveredNodeId}
                hoveredHitTarget={hoveredHitTarget}
                connectionTargetNodeId={connectionTargetNodeId}
                connectionInvalidNodeId={connectionInvalidNodeId}
                scopedRenderedNodes={scopedRenderedNodes}
                exitingNodes={exitingNodes}
                nodeGeometryById={nodeGeometryById}
                geometrySpec={geometrySpec}
                nodeMotion={nodeMotion}
                nodeProximityScale={nodeProximityScale}
                imageDisplaySrcBySrc={imageDisplaySrcBySrc}
                markdownDocumentPreviewByNodeId={markdownDocumentPreviewByNodeId}
                textDocumentPreviewByNodeId={textDocumentPreviewByNodeId}
                runtimeCreateScale={runtimeCreateScale}
                visualTokens={visualTokens}
                nodeThemeTokens={nodeThemeTokens}
                specialNodeTokens={specialNodeTokens}
                typography={typography}
                markdownTokens={markdownTokens}
                fontRevision={fontRevision}
                selectedTableCell={selectedTableCell}
                onRequestMarkdownDocumentPreview={onRequestMarkdownDocumentPreview}
                onRequestTextDocumentPreview={onRequestTextDocumentPreview}
              />
            </CanvasNodeTextureCacheProvider>

          </Layer>

          <Layer ref={interactionLayerRef} name="canvas-interaction-layer" imageSmoothingEnabled listening={false}>
            <KonvaInteractionLayerContent stageProps={stageProps} />
          </Layer>
        </Stage>
        </div>
        <canvas
          ref={rebaseGuardRef}
          className="pointer-events-none absolute inset-0 z-[1]"
          aria-hidden="true"
          hidden
        />
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
          viewport={liveViewport}
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
          <NodeActionTooltip node={hoveredActionNode} action={hoveredAction} geometry={hoveredActionGeometry} viewport={liveViewport} dimensions={dimensions} />
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

function useSceneRevision(inputs: readonly unknown[]) {
  const revisionRef = useRef<{ inputs: readonly unknown[]; value: object } | undefined>(undefined);
  if (!revisionRef.current || revisionRef.current.inputs.length !== inputs.length || inputs.some((input, index) => !Object.is(input, revisionRef.current?.inputs[index]))) {
    revisionRef.current = { inputs, value: {} };
  }
  return revisionRef.current.value;
}
