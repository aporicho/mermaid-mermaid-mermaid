"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { cn } from "@/lib/utils";

export type OverlayLayerScopeKind = "document" | "application" | "workspace";

export type OverlayLayerScopeValue = {
  scopeId: string;
  kind: OverlayLayerScopeKind;
  portalContainer: HTMLElement | null;
};

const DOCUMENT_OVERLAY_SCOPE: OverlayLayerScopeValue = {
  scopeId: "document",
  kind: "document",
  portalContainer: null
};

const OverlayLayerScopeContext = createContext<OverlayLayerScopeValue>(DOCUMENT_OVERLAY_SCOPE);

export function OverlayLayerScopeProvider({
  scopeId,
  kind,
  className,
  children
}: {
  scopeId: string;
  kind: Exclude<OverlayLayerScopeKind, "document">;
  className?: string;
  children: ReactNode;
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const value = useMemo<OverlayLayerScopeValue>(
    () => ({ scopeId, kind, portalContainer }),
    [kind, portalContainer, scopeId]
  );

  return (
    <OverlayLayerScopeContext.Provider value={value}>
      {children}
      <div
        ref={setPortalContainer}
        className={cn(
          "pointer-events-none isolate overflow-visible",
          kind === "application" ? "fixed inset-0 z-[1]" : "absolute inset-0 z-[1]",
          className
        )}
        data-overlay-layer-host={kind}
        data-overlay-scope-id={scopeId}
      />
    </OverlayLayerScopeContext.Provider>
  );
}

export function useOverlayLayerScope() {
  return useContext(OverlayLayerScopeContext);
}

export function useOverlayPortalContainer(explicitContainer?: HTMLElement | null) {
  const scope = useOverlayLayerScope();
  return {
    ...scope,
    portalContainer: explicitContainer ?? scope.portalContainer
  };
}
