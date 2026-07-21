import type { ReactNode } from "react";

import type { ButtonProps } from "@/components/ui/button";
import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
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
    <EditorIconButton
      context="floating"
      tone={danger ? "danger" : active ? "active" : "neutral"}
      pressed={active}
      label={label}
      tooltipSide={tooltipSide}
      dirty={dirty}
      badgeCount={badgeCount}
      className={cn(EDITOR_CHROME_CLASSES.floatingIconButton, !active && !danger && EDITOR_CHROME_CLASSES.floatingIconInactive, className)}
      data-floating-chrome-button
      {...buttonProps}
    >
      {children}
    </EditorIconButton>
  );
}
