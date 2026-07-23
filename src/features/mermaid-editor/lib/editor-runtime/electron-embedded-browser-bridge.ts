import type { EmbeddedBrowserLogicalRect } from "@/features/mermaid-editor/lib/embedded-browser-rect";
import type { RuntimeEmbeddedBrowserState } from "@/features/mermaid-editor/lib/editor-runtime/types";

export type ElectronEmbeddedBrowserCreateResult =
  | { status: "created"; label: string }
  | { status: "unsupported" | "error"; message: string };

export type ElectronEmbeddedBrowserStateEvent = RuntimeEmbeddedBrowserState & { label: string };

export type ElectronEmbeddedBrowserBridge = {
  createEmbeddedBrowser: (request: {
    label: string;
    url: string;
    rect: EmbeddedBrowserLogicalRect;
  }) => Promise<ElectronEmbeddedBrowserCreateResult>;
  closeEmbeddedBrowser: (label: string) => Promise<void>;
  hideEmbeddedBrowser: (label: string) => Promise<void>;
  showEmbeddedBrowser: (label: string) => Promise<void>;
  focusEmbeddedBrowser: (label: string) => Promise<void>;
  navigateEmbeddedBrowser: (label: string, url: string) => Promise<void>;
  reloadEmbeddedBrowser: (label: string) => Promise<void>;
  setEmbeddedBrowserRect: (label: string, rect: EmbeddedBrowserLogicalRect) => Promise<void>;
  onEmbeddedBrowserError: (handler: (event: { label: string; message: string }) => void) => () => void;
  onEmbeddedBrowserFocus: (handler: (event: { label: string }) => void) => () => void;
  onEmbeddedBrowserState: (handler: (event: ElectronEmbeddedBrowserStateEvent) => void) => () => void;
};
