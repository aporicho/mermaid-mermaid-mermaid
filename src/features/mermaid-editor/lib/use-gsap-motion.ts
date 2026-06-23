import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

import type { EditorMotionTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { DEFAULT_EDITOR_MOTION } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveRuntimeEditorMotion, type RuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";

gsap.registerPlugin(useGSAP);

export const EditorMotionContext = createContext<RuntimeEditorMotion>(resolveRuntimeEditorMotion(DEFAULT_EDITOR_MOTION));
export const EditorMotionProvider = EditorMotionContext.Provider;

export function useEditorMotion() {
  return useContext(EditorMotionContext);
}

export function useResolvedEditorMotion(tokens: EditorMotionTokens) {
  const reduced = usePrefersReducedMotion();
  return useMemo(() => resolveRuntimeEditorMotion(tokens, reduced), [reduced, tokens]);
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    function onChange(event: MediaQueryListEvent) {
      setReduced(event.matches);
    }

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export { gsap, useGSAP };
