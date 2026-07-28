import { createContext, useContext, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Group } from "react-konva";
import type Konva from "konva";

import {
  canvasStaticCacheKey,
  CanvasNodeTextureCacheController,
  type CanvasNodeTextureCacheKind
} from "@/features/mermaid-editor/components/konva-canvas/canvas-node-texture-cache";

export { canvasStaticCacheKey };

const CanvasNodeTextureCacheContext = createContext<CanvasNodeTextureCacheController | null>(null);

export function CanvasNodeTextureCacheProvider({
  controller,
  children
}: {
  controller: CanvasNodeTextureCacheController;
  children: ReactNode;
}) {
  return <CanvasNodeTextureCacheContext.Provider value={controller}>{children}</CanvasNodeTextureCacheContext.Provider>;
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
  const controller = useContext(CanvasNodeTextureCacheContext);
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
