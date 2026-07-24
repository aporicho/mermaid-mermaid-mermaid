import { useCallback, useRef, useState } from "react";

import type { EditorRecentAction } from "@/features/mermaid-editor/lib/editor-interaction-state";

export function useEditorRecentActions() {
  const actionCounterRef = useRef(0);
  const [recentActions, setRecentActions] = useState<EditorRecentAction[]>([]);

  const recordRecentAction = useCallback((type: string, target?: EditorRecentAction["target"], summary?: string) => {
    const action: EditorRecentAction = {
      id: `${Date.now().toString(36)}-${actionCounterRef.current++}`,
      at: new Date().toISOString(),
      type,
      target,
      summary
    };
    setRecentActions((current) => [action, ...current].slice(0, 20));
  }, []);

  return { recentActions, recordRecentAction };
}
