import type { PixiCanvasRuntime } from "@/features/mermaid-editor/components/canvas-document-editor/types";
import { schedulePixiRender } from "@/features/mermaid-editor/components/canvas-document-editor/pixi-runtime";
import { gsap } from "@/features/mermaid-editor/lib/use-gsap-motion";

export function animateCanvasDocumentElementCreated(pixi: PixiCanvasRuntime | null, id: string) {
  window.requestAnimationFrame(() => {
    const view = pixi?.views.get(id);
    if (!view || !pixi) return;
    view.container.alpha = 0.72;
    view.container.scale.set(0.96);
    gsap.to(view.container, {
      alpha: 1,
      duration: 0.16,
      ease: "power2.out",
      onUpdate: () => schedulePixiRender(pixi)
    });
    gsap.to(view.container.scale, {
      x: 1,
      y: 1,
      duration: 0.16,
      ease: "power2.out",
      onUpdate: () => schedulePixiRender(pixi)
    });
  });
}
