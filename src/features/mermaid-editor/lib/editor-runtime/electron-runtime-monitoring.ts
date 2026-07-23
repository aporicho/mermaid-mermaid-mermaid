import type { ElectronMonitoringBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-monitoring-bridge-types";

export function createElectronRuntimeMonitoring(bridge: ElectronMonitoringBridge) {
  return {
    async getDesktopWindowFullscreen() { return bridge.getWindowFullscreen(); },
    async toggleDesktopWindowFullscreen() { return bridge.toggleWindowFullscreen(); },
    async listenForDesktopWindowFullscreenChange(handler: (fullscreen: boolean) => void) { return bridge.onWindowFullscreenChange(handler); },
    async setProjectFileWatchTargets(targets: Parameters<ElectronMonitoringBridge["setProjectFileWatchTargets"]>[0]) { await bridge.setProjectFileWatchTargets(targets); },
    async listenForProjectFileChanges(handler: Parameters<ElectronMonitoringBridge["onProjectFileChanges"]>[0]) { return bridge.onProjectFileChanges(handler); }
  };
}
