import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  EDITOR_CHROME_CLASSES,
  FLOATING_CHROME_PLACEMENTS,
  type FloatingChromePlacement
} from "@/features/mermaid-editor/lib/editor-chrome";
import { FLOATING_CHROME_HIDE_DELAY_MS, shouldRevealFloatingGroup } from "@/features/mermaid-editor/lib/floating-chrome";
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
  const hideTimerRef = useRef<number | null>(null);
  const placementSpec = FLOATING_CHROME_PLACEMENTS[placement];
  const visible = shouldRevealFloatingGroup({ hovered, focusWithin, pinned });

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

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
          className={cn(
            "transition-[opacity,transform] duration-150 ease-out",
            visible ? "pointer-events-auto translate-x-0 translate-y-0 opacity-100" : cn("pointer-events-none opacity-0", placementSpec.hiddenClassName),
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
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
