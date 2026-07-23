export type EmbeddedBrowserLayerRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type EmbeddedBrowserLayer = {
  rect: EmbeddedBrowserLayerRect;
  zIndex: number;
};

export function isEmbeddedBrowserLayerOccluded({
  rect,
  zIndex,
  higherLayers
}: {
  rect: EmbeddedBrowserLayerRect;
  zIndex: number;
  higherLayers: EmbeddedBrowserLayer[];
}) {
  return higherLayers.some((layer) => layer.zIndex > zIndex && rectanglesOverlap(rect, layer.rect));
}

export function isEmbeddedBrowserSurfaceOccluded(surface: HTMLElement) {
  const owner = surface.closest<HTMLElement>("[data-floating-panel-kind='workspace']");
  if (!owner) return false;
  const ownerZIndex = numericZIndex(owner);
  const rect = surface.getBoundingClientRect();
  const higherLayers = Array.from(document.querySelectorAll<HTMLElement>("[data-floating-panel-kind='workspace']"))
    .filter((panel) => panel !== owner && panel.getAttribute("aria-hidden") !== "true" && !panel.inert)
    .map((panel) => ({ rect: panel.getBoundingClientRect(), zIndex: numericZIndex(panel) }));

  if (isEmbeddedBrowserLayerOccluded({ rect, zIndex: ownerZIndex, higherLayers })) return true;

  const ownerScopeId = owner.dataset.overlayScopeId;
  return Array.from(document.querySelectorAll<HTMLElement>("[data-overlay-layer]"))
    .some((layer) => {
      if (!isVisibleOverlayLayer(layer)) return false;
      const layerRect = layer.getBoundingClientRect();
      if (!rectanglesOverlap(rect, layerRect)) return false;

      const layerOwner = layer.closest<HTMLElement>("[data-floating-panel-kind='workspace']");
      if (layerOwner === owner || layer.dataset.overlayScopeId === ownerScopeId) return true;
      if (!layerOwner) return true;
      return numericZIndex(layerOwner) > ownerZIndex;
    });
}

export function rectanglesOverlap(first: EmbeddedBrowserLayerRect, second: EmbeddedBrowserLayerRect) {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;
}

function numericZIndex(element: HTMLElement) {
  const parsed = Number.parseFloat(window.getComputedStyle(element).zIndex);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isVisibleOverlayLayer(element: HTMLElement) {
  if (element.getAttribute("aria-hidden") === "true" || element.inert) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
