import type { AiCanvasSize, AiEditingContext } from "@/features/mermaid-editor/lib/ai-context";
import type { DiagramType, MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_IMAGE_ASSET_HEIGHT, DEFAULT_IMAGE_ASSET_WIDTH } from "@/features/mermaid-editor/lib/node-assets";

export type CanvasLiveState = {
  canvasSize?: AiCanvasSize;
  editing?: Exclude<AiEditingContext, { kind: "source" }> | null;
  interaction?: string;
};

export function diagramTypeLabel(diagramType: DiagramType) {
  const labels: Record<DiagramType, string> = {
    flowchart: "Flowchart",
    sequence: "Sequence",
    class: "Class",
    state: "State",
    er: "ER",
    gantt: "Gantt",
    pie: "Pie",
    mindmap: "Mindmap",
    timeline: "Timeline",
    architecture: "Architecture",
    unknown: "Mermaid"
  };

  return labels[diagramType];
}

export function resolveGraphImageDisplaySources(graph: MermaidGraph, displaySrcBySrc: Record<string, string>): MermaidGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const displayAssetSrc = node.asset?.kind === "image" ? displaySrcBySrc[node.asset.src] : "";
      const displayCoverSrc = node.preview?.cover?.src ? displaySrcBySrc[node.preview.cover.src] : "";
      return {
        ...node,
        ...(displayAssetSrc && node.asset && displayAssetSrc !== node.asset.src ? { asset: { ...node.asset, src: displayAssetSrc } } : {}),
        ...(displayCoverSrc && node.preview?.cover && displayCoverSrc !== node.preview.cover.src ? { preview: { ...node.preview, cover: { ...node.preview.cover, src: displayCoverSrc } } } : {})
      };
    })
  };
}

export function viewportCenterPoint(viewport: ViewportState, canvasSize?: AiCanvasSize) {
  const width = canvasSize?.width || 840;
  const height = canvasSize?.height || 520;
  return {
    x: (width / 2 - viewport.x) / viewport.scale,
    y: (height / 2 - viewport.y) / viewport.scale
  };
}

export function imageLabelFromSrc(src: string) {
  return src.split(/[\\/]/).filter(Boolean).at(-1)?.replace(/\.[^.]+$/, "") || "图片";
}

export async function loadImageDimensions(src: string) {
  if (typeof window === "undefined" || !src) return { width: DEFAULT_IMAGE_ASSET_WIDTH, height: DEFAULT_IMAGE_ASSET_HEIGHT };

  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const width = image.naturalWidth || DEFAULT_IMAGE_ASSET_WIDTH;
      const height = image.naturalHeight || DEFAULT_IMAGE_ASSET_HEIGHT;
      const maxSide = Math.max(width, height, 1);
      const scale = maxSide > 360 ? 360 / maxSide : 1;
      resolve({
        width: Math.max(48, Math.round(width * scale)),
        height: Math.max(48, Math.round(height * scale))
      });
    };
    image.onerror = () => resolve({ width: DEFAULT_IMAGE_ASSET_WIDTH, height: DEFAULT_IMAGE_ASSET_HEIGHT });
    image.src = src;
  });
}

export function canvasLiveStateKey(state: CanvasLiveState) {
  return JSON.stringify({
    width: state.canvasSize?.width || 0,
    height: state.canvasSize?.height || 0,
    editing: state.editing || null,
    interaction: state.interaction || ""
  });
}
