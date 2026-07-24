import { forwardRef, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { withDataIcon } from "./icon-slot";

const editorIconButtonVariants = cva("relative shrink-0", {
  variants: {
    context: {
      floating: "size-12",
      panel: "",
      toolbar: "",
      inline: ""
    }
  },
  defaultVariants: { context: "panel" }
});

export const EditorIconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "size"> & VariantProps<typeof editorIconButtonVariants> & {
  label: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tone?: "neutral" | "active" | "danger";
  pressed?: boolean;
  dirty?: boolean;
  badgeCount?: number;
  shortcut?: ReactNode;
  children: ReactNode;
}>(function EditorIconButton({ label, tooltipSide = "bottom", context = "panel", tone = "neutral", pressed, dirty, badgeCount, shortcut, className, children, variant, ...props }, ref) {
  const resolvedVariant = variant ?? (tone === "danger" ? "destructive" : pressed || tone === "active" ? "secondary" : "ghost");
  const size = context === "floating" ? "icon-lg" : "icon-sm";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          size={size}
          variant={resolvedVariant}
          className={cn(editorIconButtonVariants({ context }), className)}
          aria-label={label}
          aria-pressed={pressed}
          {...props}
        >
          {withDataIcon(children)}
          {dirty ? <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" aria-hidden /> : null}
          {badgeCount && badgeCount > 0 ? <Badge tone="accent" className="absolute -right-1 -top-1 min-h-4 min-w-4 justify-center border-0 px-1 text-[10px] leading-none">{badgeCount}</Badge> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
});

export { editorIconButtonVariants };
