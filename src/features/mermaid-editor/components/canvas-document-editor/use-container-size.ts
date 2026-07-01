import { useEffect, useState, type RefObject } from "react";

import { DEFAULT_DIMENSIONS } from "./constants";

export function useContainerSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState(DEFAULT_DIMENSIONS);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height))
      });
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
