import { useEffect, useRef, useState } from "react";

import { typographyFontRequests, type EditorTypographyTokens } from "@/features/mermaid-editor/lib/editor-theme";

export function useThemeFontRevision(typography: EditorTypographyTokens) {
  const [revision, setRevision] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.load) return;
    const request = ++requestRef.current;
    const fonts = typographyFontRequests(typography);
    void Promise.all(fonts.map((font) => document.fonts.load(`${font.fontWeight} 16px ${safeCssFontValue(font.family)}`, "中Aa").catch(() => [])))
      .then(() => document.fonts.ready)
      .then(() => {
        if (request === requestRef.current) setRevision((current) => current + 1);
      });
  }, [typography]);

  return revision;
}

function safeCssFontValue(value: string) {
  return value.replace(/[;{}<>]/g, " ");
}
