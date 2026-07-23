import { getTauriCurrentWindow } from "@/features/mermaid-editor/lib/editor-runtime/tauri-bridge";

export function createTauriWindowFullscreenOperations() {
  return {
    async getDesktopWindowFullscreen() {
      return (await getTauriCurrentWindow())?.isFullscreen() ?? false;
    },
    async toggleDesktopWindowFullscreen() {
      const windowRef = await getTauriCurrentWindow();
      if (!windowRef) return false;
      const fullscreen = !(await windowRef.isFullscreen());
      await windowRef.setFullscreen(fullscreen);
      return fullscreen;
    }
  };
}
