import { useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";

export type CanvasNodeImageLoadStatus = "idle" | "loading" | "loaded" | "error";

export function CanvasNodeImage({
  src,
  x,
  y,
  width,
  height,
  onLoadStatusChange
}: {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onLoadStatusChange?: (status: CanvasNodeImageLoadStatus) => void;
}) {
  const image = useCanvasImage(src, onLoadStatusChange);

  if (!image) {
    return null;
  }

  return <KonvaImage image={image} x={x} y={y} width={width} height={height} listening={false} />;
}

function useCanvasImage(src: string, onLoadStatusChange?: (status: CanvasNodeImageLoadStatus) => void) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !src) {
      setImage(null);
      onLoadStatusChange?.("idle");
      return;
    }

    let disposed = false;
    setImage(null);
    onLoadStatusChange?.("loading");
    const nextImage = new window.Image();
    if (shouldUseAnonymousImageCrossOrigin(src)) {
      nextImage.crossOrigin = "anonymous";
    }
    nextImage.onload = () => {
      if (!disposed) {
        setImage(nextImage);
        onLoadStatusChange?.("loaded");
      }
    };
    nextImage.onerror = () => {
      if (!disposed) {
        setImage(null);
        onLoadStatusChange?.("error");
      }
    };
    nextImage.src = src;

    return () => {
      disposed = true;
    };
  }, [onLoadStatusChange, src]);

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
