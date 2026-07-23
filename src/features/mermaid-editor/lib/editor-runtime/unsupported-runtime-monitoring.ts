import type { RuntimeProjectFileWatchOperations } from "@/features/mermaid-editor/lib/editor-runtime/project-file-watch-types";

export function createUnsupportedRuntimeMonitoringOperations(): RuntimeProjectFileWatchOperations & {
  getDesktopWindowFullscreen: () => Promise<boolean>;
  toggleDesktopWindowFullscreen: () => Promise<boolean>;
  listenForDesktopWindowFullscreenChange: () => Promise<() => void>;
} {
  return {
    async getDesktopWindowFullscreen() { return false; },
    async toggleDesktopWindowFullscreen() { return false; },
    async listenForDesktopWindowFullscreenChange() { return () => undefined; },
    async setProjectFileWatchTargets() { /* Native path watching is unavailable. */ },
    async listenForProjectFileChanges() { return () => undefined; }
  };
}
