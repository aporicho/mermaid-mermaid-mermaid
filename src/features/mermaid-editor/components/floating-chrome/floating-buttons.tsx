import type { ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import { cn } from "@/lib/utils";

import type { FloatingTooltipSide } from "./shared";

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
          data-floating-chrome-button
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
