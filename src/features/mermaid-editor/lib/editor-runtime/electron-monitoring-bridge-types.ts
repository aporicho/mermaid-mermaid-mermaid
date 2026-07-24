import type { RuntimeProjectFileChangeBatch, RuntimeProjectFileWatchTargets } from "@/features/mermaid-editor/lib/editor-runtime/project-file-watch-types";

export type ElectronMonitoringBridge = {
  getWindowFullscreen: () => Promise<boolean>;
  toggleWindowFullscreen: () => Promise<boolean>;
  onWindowFullscreenChange: (handler: (fullscreen: boolean) => void) => () => void;
  setProjectFileWatchTargets: (request: RuntimeProjectFileWatchTargets) => Promise<unknown>;
  onProjectFileChanges: (handler: (batch: RuntimeProjectFileChangeBatch) => void) => () => void;
};
