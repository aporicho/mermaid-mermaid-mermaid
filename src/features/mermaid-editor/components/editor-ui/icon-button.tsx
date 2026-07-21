import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const editorIconButtonVariants = cva("relative shrink-0", {
  variants: {
    context: {
      floating: "size-12 min-h-12 rounded-[var(--theme-radius-control-lg)] bg-card/95",
      panel: "editor-ui-icon-button bg-card/85",
      toolbar: "editor-ui-icon-button",
      inline: "editor-ui-icon-button"
    },
    tone: {
      neutral: "text-icon hover:text-foreground",
      active: "bg-primary text-background hover:bg-primary/90 hover:text-background",
      danger: "text-icon hover:bg-destructive/10 hover:text-destructive"
    }
  },
  defaultVariants: { context: "panel", tone: "neutral" }
});

export function EditorIconButton({ label, tooltipSide = "bottom", context, tone, pressed, dirty, badgeCount, className, children, ...props }: Omit<ButtonProps, "size"> & VariantProps<typeof editorIconButtonVariants> & {
  label: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  pressed?: boolean;
  dirty?: boolean;
  badgeCount?: number;
  children: ReactNode;
}) {
  const resolvedTone = pressed && tone !== "danger" ? "active" : tone;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={pressed ? "default" : "ghost"}
          className={cn(editorIconButtonVariants({ context, tone: resolvedTone }), dirty && "border-primary/45 text-primary", className)}
          aria-label={label}
          aria-pressed={pressed}
          {...props}
        >
          {children}
          {dirty ? <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" aria-hidden /> : null}
          {badgeCount && badgeCount > 0 ? <Badge tone="accent" className="absolute -right-1 -top-1 min-h-4 min-w-4 justify-center border-0 px-1 text-[10px] leading-none">{badgeCount}</Badge> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}

export { editorIconButtonVariants };
