import { useLayoutEffect } from "react";
import { Image as KonvaImage } from "react-konva";

import { useDecodedCanvasImage } from "@/features/mermaid-editor/components/konva-canvas/use-decoded-canvas-image";
import { useCanvasSceneInvalidation } from "@/features/mermaid-editor/components/konva-canvas/canvas-static-cache-group";

export function CanvasNodeImage({
  src,
  x,
  y,
  width,
  height
}: {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const { image } = useDecodedCanvasImage(src);
  const invalidateScene = useCanvasSceneInvalidation();
  useLayoutEffect(() => {
    if (image) invalidateScene?.("image-decoded");
  }, [image, invalidateScene]);

  if (!image) {
    return null;
  }

  return <KonvaImage image={image} x={x} y={y} width={width} height={height} listening={false} perfectDrawEnabled={false} />;
}
