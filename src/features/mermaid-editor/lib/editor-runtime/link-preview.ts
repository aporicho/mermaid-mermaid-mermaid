import { tauriInvoke } from "@/features/mermaid-editor/lib/editor-runtime/tauri-bridge";
import type { RuntimeLinkPreviewRequest, RuntimeLinkPreviewResult } from "@/features/mermaid-editor/lib/editor-runtime/types";

export async function resolveDesktopLinkPreview(request: RuntimeLinkPreviewRequest): Promise<RuntimeLinkPreviewResult> {
  return tauriInvoke<RuntimeLinkPreviewResult>("resolve_link_preview", request);
}
