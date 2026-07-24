import { describe, expect, it } from "vitest";

import {
  clampImageViewerZoom,
  imageViewerWatchPath,
  imageViewerInitialViewport,
  imageViewerLayout,
  imageViewerNavigationDirectionForKey,
  imageViewerPresetViewport,
  imageViewerZoomBounds,
  normalizeImageViewerRotation,
  revisionedImageViewerSrc
} from "@/features/mermaid-editor/lib/image-viewer";

describe("image viewer", () => {
  it("fills one viewport axis while keeping the complete image visible", () => {
    expect(imageViewerLayout({
      naturalWidth: 1600,
      naturalHeight: 900,
      viewportWidth: 1000,
      viewportHeight: 700,
      rotation: 0,
      mode: "fit",
      zoom: 1
    })).toEqual({ scale: 0.625, stageWidth: 1000, stageHeight: 562.5 });

    expect(imageViewerLayout({
      naturalWidth: 1600,
      naturalHeight: 900,
      viewportWidth: 1000,
      viewportHeight: 700,
      rotation: 90,
      mode: "fit",
      zoom: 1
    })).toEqual({ scale: 0.4375, stageWidth: 393.75, stageHeight: 700 });

    expect(imageViewerLayout({
      naturalWidth: 400,
      naturalHeight: 200,
      viewportWidth: 1000,
      viewportHeight: 700,
      rotation: 0,
      mode: "fit",
      zoom: 1
    })).toEqual({ scale: 2.5, stageWidth: 1000, stageHeight: 500 });
  });

  it("normalizes rotations and clamps unsafe zoom values", () => {
    expect(normalizeImageViewerRotation(-90)).toBe(270);
    expect(normalizeImageViewerRotation(450)).toBe(90);
    expect(clampImageViewerZoom(0)).toBe(0.05);
    expect(clampImageViewerZoom(100)).toBe(16);
    expect(imageViewerZoomBounds(0.001)).toEqual({ min: 0.00001, max: 16 });
    expect(imageViewerZoomBounds(64)).toEqual({ min: 0.05, max: 6400 });
  });

  it("represents fit and actual size as centered canvas viewports", () => {
    expect(imageViewerPresetViewport({
      naturalWidth: 1600,
      naturalHeight: 900,
      viewportWidth: 1000,
      viewportHeight: 700,
      rotation: 0,
      mode: "fit"
    })).toEqual({ x: 500, y: 350, scale: 0.625 });
    expect(imageViewerPresetViewport({
      naturalWidth: 1600,
      naturalHeight: 900,
      viewportWidth: 1000,
      viewportHeight: 700,
      rotation: 0,
      mode: "actual"
    })).toEqual({ x: 500, y: 350, scale: 1 });
  });

  it("opens small images at actual size and only shrinks images larger than the viewport", () => {
    expect(imageViewerInitialViewport({
      naturalWidth: 400,
      naturalHeight: 200,
      viewportWidth: 1000,
      viewportHeight: 700,
      rotation: 0
    })).toEqual({ x: 500, y: 350, scale: 1 });
    expect(imageViewerInitialViewport({
      naturalWidth: 1600,
      naturalHeight: 900,
      viewportWidth: 1000,
      viewportHeight: 700,
      rotation: 0
    })).toEqual({ x: 500, y: 350, scale: 0.625 });
  });

  it("maps horizontal and vertical arrow keys to adjacent images", () => {
    expect(imageViewerNavigationDirectionForKey("ArrowLeft")).toBe(-1);
    expect(imageViewerNavigationDirectionForKey("ArrowUp")).toBe(-1);
    expect(imageViewerNavigationDirectionForKey("ArrowRight")).toBe(1);
    expect(imageViewerNavigationDirectionForKey("ArrowDown")).toBe(1);
    expect(imageViewerNavigationDirectionForKey("Enter")).toBeNull();
  });

  it("adds a refresh revision without breaking an existing asset query", () => {
    expect(revisionedImageViewerSrc("mmm-asset://local/?path=%2Fcover.png", 3)).toBe("mmm-asset://local/?path=%2Fcover.png&viewerRevision=3");
    expect(revisionedImageViewerSrc("data:image/png;base64,a", 3)).toBe("data:image/png;base64,a");
  });

  it("resolves local canvas image sources for file watching without treating URLs as files", () => {
    expect(imageViewerWatchPath("assets/cover.png", "/project/board.canvas.json")).toBe("/project/assets/cover.png");
    expect(imageViewerWatchPath("/project/cover.png", "/project/board.canvas.json")).toBe("/project/cover.png");
    expect(imageViewerWatchPath("https://example.com/cover.png", "/project/board.canvas.json")).toBe("");
  });
});
