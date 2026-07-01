import type { RefObject } from "react";

import type {
  FloatingPanelKind,
  FloatingPanelOffset,
  FloatingPanelPlacement
} from "@/features/mermaid-editor/lib/floating-chrome";
import { gsap, useEditorMotion, useGSAP } from "@/features/mermaid-editor/lib/use-gsap-motion";

export function useFloatingPanelMotion({
  surfaceRef,
  mounted,
  open,
  kind,
  placement,
  hiddenOffset,
  onExited
}: {
  surfaceRef: RefObject<HTMLDivElement | null>;
  mounted: boolean;
  open: boolean;
  kind: FloatingPanelKind;
  placement: FloatingPanelPlacement;
  hiddenOffset: FloatingPanelOffset;
  onExited: () => void;
}) {
  const motion = useEditorMotion();

  useGSAP(
    () => {
      const element = surfaceRef.current;
      if (!element || !mounted) return;
      const items = element.querySelectorAll("[data-floating-action-item]");

      if (open) {
        gsap.fromTo(
          element,
          {
            autoAlpha: motion.reduced ? 1 : 0,
            x: motion.reduced ? 0 : hiddenOffset.x,
            y: motion.reduced ? 0 : hiddenOffset.y,
            scale: motion.reduced ? 1 : 0.94
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: motion.duration.base,
            ease: motion.ease.emphasized,
            overwrite: "auto",
            onComplete: () => {
              if (kind === "workspace") {
                gsap.set(element, { clearProps: "transform" });
              }
            }
          }
        );
        if (items.length) {
          gsap.fromTo(
            items,
            { autoAlpha: motion.reduced ? 1 : 0, y: motion.reduced ? 0 : 4 },
            {
              autoAlpha: 1,
              y: 0,
              duration: motion.duration.fast,
              delay: motion.reduced ? 0 : motion.duration.fast * 0.35,
              ease: motion.ease.standard,
              stagger: motion.stagger.list,
              overwrite: "auto"
            }
          );
        }
        return;
      }

      gsap.to(element, {
        autoAlpha: 0,
        x: motion.reduced ? 0 : hiddenOffset.x,
        y: motion.reduced ? 0 : hiddenOffset.y,
        scale: motion.reduced ? 1 : 0.98,
        duration: motion.duration.fast,
        ease: motion.ease.exit,
        overwrite: "auto",
        onComplete: onExited
      });
    },
    {
      dependencies: [
        hiddenOffset.x,
        hiddenOffset.y,
        mounted,
        motion.duration.base,
        motion.duration.fast,
        motion.ease.emphasized,
        motion.ease.exit,
        motion.ease.standard,
        motion.reduced,
        motion.stagger.list,
        open,
        kind,
        placement,
        onExited
      ],
      scope: surfaceRef
    }
  );
}
