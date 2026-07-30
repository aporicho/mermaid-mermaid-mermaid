import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import {
  markdownImageAssetsForDocument,
  type MarkdownImageAssetDependencies,
  type MarkdownImageAssets
} from "@/features/mermaid-editor/components/mermaid-editor/markdown-image-assets";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

export type MarkdownImageAssetsFactory = (documentFile: RuntimeFileRef | null) => MarkdownImageAssets;

const MarkdownImageAssetsContext = createContext<MarkdownImageAssetsFactory | null>(null);

export function MarkdownImageAssetsProvider({
  children,
  value
}: {
  children: ReactNode;
  value: MarkdownImageAssetsFactory;
}) {
  return <MarkdownImageAssetsContext.Provider value={value}>{children}</MarkdownImageAssetsContext.Provider>;
}

export function useMarkdownImageAssets(documentFile: RuntimeFileRef | null | undefined) {
  const factory = useContext(MarkdownImageAssetsContext);
  return useMemo(
    () => factory ? factory(documentFile ?? null) : undefined,
    [documentFile, factory]
  );
}

export function useMarkdownImageAssetsFactory(dependencies: MarkdownImageAssetDependencies) {
  const { runtime, projectWorkspace, refreshProjectWorkspace, onStatus, onError } = dependencies;
  return useCallback(
    (documentFile: RuntimeFileRef | null) => markdownImageAssetsForDocument({
      runtime, projectWorkspace, refreshProjectWorkspace, onStatus, onError
    }, documentFile),
    [onError, onStatus, projectWorkspace, refreshProjectWorkspace, runtime]
  );
}
