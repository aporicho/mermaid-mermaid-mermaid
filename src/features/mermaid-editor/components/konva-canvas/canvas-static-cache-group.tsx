import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, type ComponentProps, type ReactNode } from "react";
import { Group } from "react-konva";
import type Konva from "konva";

import {
  canvasStaticCacheKey,
  CanvasNodeTextureCacheController,
  type CanvasNodeTextureCacheKind
} from "@/features/mermaid-editor/components/konva-canvas/canvas-node-texture-cache";

export { canvasStaticCacheKey };

type CanvasSceneRuntime = {
  controller: CanvasNodeTextureCacheController;
  invalidateScene: (reason: string) => void;
};

const CanvasNodeTextureCacheContext = createContext<CanvasSceneRuntime | null>(null);

export function CanvasNodeTextureCacheProvider({
  controller,
  onInvalidateScene,
  children
}: {
  controller: CanvasNodeTextureCacheController;
  onInvalidateScene?: (reason: string) => void;
  children: ReactNode;
}) {
  const invalidateScene = useCallback((reason: string) => onInvalidateScene?.(reason), [onInvalidateScene]);
  const runtime = useMemo(() => ({ controller, invalidateScene }), [controller, invalidateScene]);
  return <CanvasNodeTextureCacheContext.Provider value={runtime}>{children}</CanvasNodeTextureCacheContext.Provider>;
}

export function useCanvasSceneInvalidation() {
  return useContext(CanvasNodeTextureCacheContext)?.invalidateScene;
}

export function CanvasStaticCacheGroup({
  cacheId,
  cacheKey,
  cacheKind,
  cacheEnabled = true,
  cachePriority = 1,
  children,
  ...groupProps
}: Omit<ComponentProps<typeof Group>, "ref"> & {
  cacheId: string;
  cacheKey: string;
  cacheKind: CanvasNodeTextureCacheKind;
  cacheEnabled?: boolean;
  cachePriority?: number;
}) {
  const controller = useContext(CanvasNodeTextureCacheContext)?.controller;
  const groupRef = useRef<Konva.Group | null>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!controller || !group) return;
    if (!cacheEnabled) {
      if (group.isCached()) group.clearCache();
      return;
    }
    controller.upsert({
      id: cacheId,
      key: cacheKey,
      kind: cacheKind,
      group,
      enabled: true,
      priority: cachePriority
    });
    return () => controller.unregister(cacheId, group);
  }, [cacheEnabled, cacheId, cacheKey, cacheKind, cachePriority, controller]);

  return <Group ref={groupRef} listening={false} {...groupProps}>{children}</Group>;
}
