import { useCallback, useRef, useState } from "react";

import type { AiRecentAction } from "@/features/mermaid-editor/lib/ai-context";

export function useEditorRecentActions() {
  const actionCounterRef = useRef(0);
  const [recentActions, setRecentActions] = useState<AiRecentAction[]>([]);

  const recordRecentAction = useCallback((type: string, target?: AiRecentAction["target"], summary?: string) => {
    const action: AiRecentAction = {
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
