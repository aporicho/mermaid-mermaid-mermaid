import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";

import {
  FLOATING_CHROME_PLACEMENTS,
  type FloatingChromePlacement
} from "@/features/mermaid-editor/lib/editor-chrome";
import {
  FLOATING_CHROME_HIDE_DELAY_MS,
  shouldRevealFloatingGroup
} from "@/features/mermaid-editor/lib/floating-chrome";
import { floatingPlacementOffset } from "@/features/mermaid-editor/lib/editor-motion";
import { gsap, useEditorMotion, useGSAP } from "@/features/mermaid-editor/lib/use-gsap-motion";
import { cn } from "@/lib/utils";

export function FloatingChromeLayer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("pointer-events-none absolute inset-0 z-40", className)}>{children}</div>;
}

export function FloatingChromeSlot({
  placement,
  pinned = false,
  className,
  hotZoneClassName,
  contentClassName,
  children
}: {
  placement: FloatingChromePlacement;
  pinned?: boolean;
  className?: string;
  hotZoneClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [interactable, setInteractable] = useState(pinned);
  const hideTimerRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const motion = useEditorMotion();
  const placementSpec = FLOATING_CHROME_PLACEMENTS[placement];
  const visible = shouldRevealFloatingGroup({ hovered, focusWithin, pinned });
  const hiddenOffset = floatingPlacementOffset(placement, motion.distance.chrome);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  useGSAP(
    () => {
      const element = contentRef.current;
      if (!element) return;

      if (visible) {
        setInteractable(true);
        gsap.to(element, {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: motion.duration.fast,
          ease: motion.ease.standard,
          overwrite: "auto"
        });
        gsap.fromTo(
          element.querySelectorAll("[data-floating-chrome-button]"),
          { autoAlpha: motion.reduced ? 1 : 0.9, scale: motion.reduced ? 1 : 0.96 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: motion.duration.fast,
            ease: motion.ease.emphasized,
            stagger: motion.stagger.button,
            overwrite: "auto"
          }
        );
        return;
      }

      gsap.to(element, {
        autoAlpha: 0,
        x: hiddenOffset.x,
        y: hiddenOffset.y,
        scale: motion.reduced ? 1 : 0.98,
        duration: motion.duration.fast,
        ease: motion.ease.exit,
        overwrite: "auto",
        onComplete: () => setInteractable(false)
      });
    },
    {
      dependencies: [
        hiddenOffset.x,
        hiddenOffset.y,
        motion.duration.fast,
        motion.ease.emphasized,
        motion.ease.exit,
        motion.ease.standard,
        motion.reduced,
        motion.stagger.button,
        visible
      ],
      scope: contentRef
    }
  );

  function clearHideTimer() {
    if (!hideTimerRef.current) return;
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }

  function show() {
    clearHideTimer();
    setHovered(true);
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setHovered(false);
      hideTimerRef.current = null;
    }, FLOATING_CHROME_HIDE_DELAY_MS);
  }

  function blur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setFocusWithin(false);
  }

  return (
    <div className={cn("pointer-events-auto absolute", placementSpec.rootClassName, className)}>
      <div
        className={cn("flex", placementSpec.hotZoneClassName, hotZoneClassName)}
        onPointerEnter={show}
        onPointerLeave={scheduleHide}
        onFocus={() => setFocusWithin(true)}
        onBlur={blur}
      >
        <div
          ref={contentRef}
          className={cn(
            "will-change-transform",
            interactable ? "pointer-events-auto" : "pointer-events-none",
            contentClassName
          )}
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? undefined : `translate(${hiddenOffset.x}px, ${hiddenOffset.y}px) scale(${motion.reduced ? 1 : 0.98})`
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
