import { Image as KonvaImage } from "react-konva";

import { useDecodedCanvasImage } from "@/features/mermaid-editor/components/konva-canvas/use-decoded-canvas-image";

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

  if (!image) {
    return null;
  }

  return <KonvaImage image={image} x={x} y={y} width={width} height={height} listening={false} perfectDrawEnabled={false} />;
}
