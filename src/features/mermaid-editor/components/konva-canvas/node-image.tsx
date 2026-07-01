import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Line, Rect } from "react-konva";

export function CanvasNodeImage({
  src,
  x,
  y,
  width,
  height,
  stroke
}: {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
}) {
  const image = useCanvasImage(src);

  if (!image) {
    return (
      <Group x={x} y={y} listening={false}>
        <Rect width={width} height={height} fill="rgba(255,255,255,0.35)" stroke={stroke} strokeWidth={1} dash={[5, 5]} />
        <Line points={[0, 0, width, height]} stroke={stroke} strokeWidth={1} opacity={0.45} />
        <Line points={[width, 0, 0, height]} stroke={stroke} strokeWidth={1} opacity={0.45} />
      </Group>
    );
  }

  return <KonvaImage image={image} x={x} y={y} width={width} height={height} listening={false} />;
}

function useCanvasImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !src) {
      setImage(null);
      return;
    }

    let disposed = false;
    setImage(null);
    const nextImage = new window.Image();
    if (shouldUseAnonymousImageCrossOrigin(src)) {
      nextImage.crossOrigin = "anonymous";
    }
    nextImage.onload = () => {
      if (!disposed) setImage(nextImage);
    };
    nextImage.onerror = () => {
      if (!disposed) setImage(null);
    };
    nextImage.src = src;

    return () => {
      disposed = true;
    };
  }, [src]);

  return image;
}

function shouldUseAnonymousImageCrossOrigin(src: string) {
  if (!/^https?:\/\//i.test(src)) return false;
  try {
    const url = new URL(src);
    return url.hostname !== "asset.localhost" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}
