import { useEffect, useRef } from "react";

import { DEFAULT_DIMENSIONS } from "@/features/mermaid-editor/components/canvas-document-editor/constants";
import { applyPixiViewport, createPixiCanvasRuntime, destroyPixiCanvasRuntime, resizePixiRenderer, schedulePixiRender } from "@/features/mermaid-editor/components/canvas-document-editor/pixi-runtime";
import { drawSelectionOverlay, syncPixiScene } from "@/features/mermaid-editor/components/canvas-document-editor/pixi-scene";
import type { CanvasDocumentInlineEdit, PixiCanvasRuntime } from "@/features/mermaid-editor/components/canvas-document-editor/types";
import { useCanvasDocumentImageSources } from "@/features/mermaid-editor/components/canvas-document-editor/use-canvas-document-image-sources";
import { useContainerSize } from "@/features/mermaid-editor/components/canvas-document-editor/use-container-size";
import type { CanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";
import type { CanvasDocumentDimensions } from "@/features/mermaid-editor/lib/canvas-document-rendering";
import type { StandardCanvasInteractionState } from "@/features/mermaid-editor/lib/canvas-interaction-standard";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

type CurrentRef<T> = {
  current: T;
};

type UseCanvasDocumentSceneArgs = {
  normalizedDocument: CanvasDocument;
  fileRef: RuntimeFileRef | null;
  runtime: EditorRuntime;
  documentRef: CurrentRef<CanvasDocument>;
  selectedIdsRef: CurrentRef<string[]>;
  connectorStartIdRef: CurrentRef<string | null>;
  interactionStateRef: CurrentRef<StandardCanvasInteractionState>;
  inlineEditRef: CurrentRef<CanvasDocumentInlineEdit | null>;
  onStatus?: (status: string) => void;
};

export function useCanvasDocumentScene({
  normalizedDocument,
  fileRef,
  runtime,
  documentRef,
  selectedIdsRef,
  connectorStartIdRef,
  interactionStateRef,
  inlineEditRef,
  onStatus
}: UseCanvasDocumentSceneArgs) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<PixiCanvasRuntime | null>(null);
  const dimensionsRef = useRef<CanvasDocumentDimensions>(DEFAULT_DIMENSIONS);
  const imageDisplaySrcBySrcRef = useRef<Record<string, string>>({});
  const renderCurrentSceneRef = useRef(() => {});
  const renderViewportOnlyRef = useRef(() => {});
  const dimensions = useContainerSize(containerRef);
  const imageDisplaySrcBySrc = useCanvasDocumentImageSources({ document: normalizedDocument, fileRef, runtime });

  renderCurrentSceneRef.current = () => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    syncPixiScene(pixi, documentRef.current, dimensionsRef.current, selectedIdsRef.current, connectorStartIdRef.current, imageDisplaySrcBySrcRef.current, interactionStateRef.current, inlineEditRef.current);
  };

  renderViewportOnlyRef.current = () => {
    const pixi = pixiRef.current;
    if (!pixi) return;
    applyPixiViewport(pixi, documentRef.current.viewport, dimensionsRef.current);
    drawSelectionOverlay(pixi, documentRef.current, selectedIdsRef.current, interactionStateRef.current);
    schedulePixiRender(pixi);
  };

  useEffect(() => {
    dimensionsRef.current = dimensions;
    const pixi = pixiRef.current;
    if (pixi) {
      resizePixiRenderer(pixi, dimensions);
      renderCurrentSceneRef.current();
    }
  }, [dimensions]);

  useEffect(() => {
    imageDisplaySrcBySrcRef.current = imageDisplaySrcBySrc;
    renderCurrentSceneRef.current();
  }, [imageDisplaySrcBySrc]);

  useEffect(() => {
    let disposed = false;
    const host = containerRef.current;
    if (!host) return;

    void createPixiCanvasRuntime(dimensionsRef.current)
      .then((pixi) => {
        if (disposed) {
          destroyPixiCanvasRuntime(pixi);
          return;
        }

        host.appendChild(pixi.app.canvas);
        pixiRef.current = pixi;
        renderCurrentSceneRef.current();
      })
      .catch(() => {
        if (!disposed) onStatus?.("PixiJS 画布初始化失败。");
      });

    return () => {
      disposed = true;
      const pixi = pixiRef.current;
      pixiRef.current = null;
      if (!pixi) return;
      destroyPixiCanvasRuntime(pixi);
    };
  }, [onStatus]);

  return { containerRef, pixiRef, dimensionsRef, renderCurrentSceneRef, renderViewportOnlyRef };
}
