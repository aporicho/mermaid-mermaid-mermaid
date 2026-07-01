import { useEffect, useState } from "react";

import type { CanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

export function useCanvasDocumentImageSources({
  document,
  fileRef,
  runtime
}: {
  document: CanvasDocument;
  fileRef: RuntimeFileRef | null;
  runtime: EditorRuntime;
}) {
  const [imageDisplaySrcBySrc, setImageDisplaySrcBySrc] = useState<Record<string, string>>({});

  useEffect(() => {
    const sources = Array.from(new Set(document.elements.flatMap((element) => (element.type === "image" && element.src ? [element.src] : []))));
    if (!sources.length) {
      setImageDisplaySrcBySrc({});
      return;
    }

    let disposed = false;
    void Promise.all(
      sources.map(async (src) => {
        try {
          return [src, await runtime.resolveImageAssetSrc(fileRef, src)] as const;
        } catch {
          return [src, src] as const;
        }
      })
    ).then((entries) => {
      if (!disposed) setImageDisplaySrcBySrc(Object.fromEntries(entries));
    });

    return () => {
      disposed = true;
    };
  }, [document.elements, fileRef, runtime]);

  return imageDisplaySrcBySrc;
}
