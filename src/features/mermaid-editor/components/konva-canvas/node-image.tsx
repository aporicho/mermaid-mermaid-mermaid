import { useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";

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
  const image = useCanvasImage(src);

  if (!image) {
    return null;
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
    if (isXiaohongshuImageHost(url.hostname)) return false;
    return url.hostname !== "asset.localhost" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

function isXiaohongshuImageHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (host.endsWith(".xhscdn.com") && (host.startsWith("sns-img") || host.startsWith("sns-webpic"))) || host === "ci.xiaohongshu.com" || host.endsWith(".ci.xiaohongshu.com");
}
