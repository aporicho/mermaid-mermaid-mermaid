import { useCallback, useEffect, useMemo } from "react";

import type { RuntimeEmbeddedBrowserHandle } from "@/features/mermaid-editor/lib/editor-runtime";
import type { BrowserWindowPanelId } from "@/features/mermaid-editor/lib/workspace-panels";

export function useEditorEmbeddedBrowserHandles() {
  const registry = useMemo(createEmbeddedBrowserRegistry, []);

  const setEmbeddedBrowserHandle = useCallback((panelId: BrowserWindowPanelId, handle: RuntimeEmbeddedBrowserHandle | null) => {
    registry.set(panelId, handle);
  }, [registry]);

  const closeEmbeddedBrowser = useCallback((panelId: BrowserWindowPanelId) => {
    registry.close(panelId);
  }, [registry]);

  useEffect(() => {
    return () => {
      registry.closeAll();
    };
  }, [registry]);

  return { setEmbeddedBrowserHandle, closeEmbeddedBrowser };
}

export function createEmbeddedBrowserRegistry() {
  const handles = new Map<BrowserWindowPanelId, RuntimeEmbeddedBrowserHandle>();

  return {
    set(panelId: BrowserWindowPanelId, handle: RuntimeEmbeddedBrowserHandle | null) {
      const current = handles.get(panelId);
      if (current === handle) return;
      if (!handle) {
        handles.delete(panelId);
        return;
      }
      if (current) disposeRuntimeEmbeddedBrowserHandle(current);
      handles.set(panelId, handle);
    },
    close(panelId: BrowserWindowPanelId) {
      const handle = handles.get(panelId);
      handles.delete(panelId);
      if (handle) disposeRuntimeEmbeddedBrowserHandle(handle);
    },
    closeAll() {
      const currentHandles = [...handles.values()];
      handles.clear();
      currentHandles.forEach(disposeRuntimeEmbeddedBrowserHandle);
    }
  };
}

export function disposeRuntimeEmbeddedBrowserHandle(handle: RuntimeEmbeddedBrowserHandle) {
  void handle.hide().catch(() => undefined);
  void handle.close().catch(() => undefined);
}
