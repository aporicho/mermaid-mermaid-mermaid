import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  EDITOR_CHROME_CLASSES,
  FLOATING_CHROME_PLACEMENTS,
  type FloatingChromePlacement
} from "@/features/mermaid-editor/lib/editor-chrome";
import { FLOATING_CHROME_HIDE_DELAY_MS, shouldRevealFloatingGroup } from "@/features/mermaid-editor/lib/floating-chrome";
import { floatingPlacementOffset, panelMotionOffset } from "@/features/mermaid-editor/lib/editor-motion";
import { gsap, useEditorMotion, useGSAP } from "@/features/mermaid-editor/lib/use-gsap-motion";
import { cn } from "@/lib/utils";

type FloatingTooltipSide = "top" | "right" | "bottom" | "left";

export function FloatingChromeLayer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("pointer-events-none absolute inset-0 z-30", className)}>{children}</div>;
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
          element.querySelectorAll("button"),
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

  function blur(event: React.FocusEvent<HTMLDivElement>) {
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

export function MotionPresence({
  present,
  variant,
  className,
  children
}: {
  present: boolean;
  variant: "left" | "right" | "bottom" | "top" | "workspace";
  className?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(present);
  const ref = useRef<HTMLDivElement | null>(null);
  const motion = useEditorMotion();
  const offset = panelMotionOffset(variant, variant === "workspace" ? motion.distance.viewport : motion.distance.panel);

  useEffect(() => {
    if (present) setMounted(true);
  }, [present]);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element || !mounted) return;

      if (present) {
        gsap.fromTo(
          element,
          {
            autoAlpha: motion.reduced ? 1 : 0,
            x: offset.x,
            y: offset.y,
            scale: motion.reduced ? 1 : 0.985
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: variant === "workspace" ? motion.duration.base : motion.duration.slow,
            ease: motion.ease.standard,
            overwrite: "auto"
          }
        );
        return;
      }

      gsap.to(element, {
        autoAlpha: 0,
        x: offset.x,
        y: offset.y,
        scale: motion.reduced ? 1 : 0.985,
        duration: motion.duration.base,
        ease: motion.ease.exit,
        overwrite: "auto",
        onComplete: () => setMounted(false)
      });
    },
    {
      dependencies: [
        mounted,
        motion.duration.base,
        motion.duration.slow,
        motion.ease.exit,
        motion.ease.standard,
        motion.reduced,
        offset.x,
        offset.y,
        present,
        variant
      ],
      scope: ref
    }
  );

  if (!mounted) return null;

  return (
    <div ref={ref} className={className} style={{ opacity: present ? 1 : 0 }}>
      {children}
    </div>
  );
}

export function FloatingButtonCluster({
  orientation = "horizontal",
  className,
  children
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(EDITOR_CHROME_CLASSES.floatingButtonCluster, orientation === "vertical" && "flex-col", className)}>
      {children}
    </div>
  );
}

export function FloatingIconButton({
  label,
  tooltipSide = "bottom",
  active = false,
  danger = false,
  dirty = false,
  badgeCount,
  className,
  children,
  ...buttonProps
}: Omit<ButtonProps, "size" | "variant"> & {
  label: string;
  tooltipSide?: FloatingTooltipSide;
  active?: boolean;
  danger?: boolean;
  dirty?: boolean;
  badgeCount?: number;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={active ? "default" : "outline"}
          className={cn(
            EDITOR_CHROME_CLASSES.floatingIconButton,
            active ? EDITOR_CHROME_CLASSES.floatingIconActive : EDITOR_CHROME_CLASSES.floatingIconInactive,
            danger && EDITOR_CHROME_CLASSES.floatingIconDanger,
            dirty && "border-primary/45 text-primary hover:text-primary",
            className
          )}
          aria-label={label}
          {...buttonProps}
        >
          {children}
          {dirty ? <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" aria-hidden /> : null}
          {badgeCount && badgeCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none text-background">
              {badgeCount}
            </span>
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}
