import type { CanvasNodePreviewCover } from "@/features/mermaid-editor/lib/editor-types";

export type RuntimeLinkPreviewRequest = {
  pluginId: string;
  url: string;
  documentPath?: string;
};

export type RuntimeLinkPreviewResult =
  | {
      status: "ready";
      provider: string;
      sourceUrl: string;
      canonicalUrl?: string;
      title: string;
      cover?: CanvasNodePreviewCover;
    }
  | {
      status: "fallback";
      provider: string;
      sourceUrl: string;
      canonicalUrl?: string;
      title: string;
      cover?: CanvasNodePreviewCover;
      message?: string;
    }
  | {
      status: "unsupported";
      message: string;
    };
