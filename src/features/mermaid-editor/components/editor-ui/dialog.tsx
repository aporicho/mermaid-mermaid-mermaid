import type { KeyboardEventHandler, ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { withDataIcon } from "./icon-slot";

const dialogSizeClass = { sm: "sm:max-w-[416px]", md: "sm:max-w-[520px]", lg: "sm:max-w-xl" } as const;

export function EditorDialog({ open, onOpenChange, title, description, icon, children, footer, size = "md", dismissible = true, showCloseButton = dismissible, chrome = "standard", contained = false, container, className, onKeyDown }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof dialogSizeClass;
  dismissible?: boolean;
  showCloseButton?: boolean;
  chrome?: "standard" | "quiet";
  contained?: boolean;
  container?: HTMLElement | null;
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}) {
  const quiet = chrome === "quiet";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen || dismissible) onOpenChange(nextOpen); }}>
      <DialogContent
        container={container}
        contained={contained}
        showCloseButton={showCloseButton}
        className={cn("grid grid-rows-[auto_minmax(0,1fr)_auto]", dialogSizeClass[size], className)}
        onEscapeKeyDown={(event) => { if (!dismissible) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (!dismissible) event.preventDefault(); }}
        onKeyDown={onKeyDown}
      >
        <DialogHeader className={cn(icon && "grid grid-cols-[auto_minmax(0,1fr)] gap-x-2")}>
          {icon ? <div className="row-span-2">{withDataIcon(icon)}</div> : null}
          <DialogTitle className="type-interface-heading">{title}</DialogTitle>
          {description ? <DialogDescription className="type-interface-metadata">{description}</DialogDescription> : null}
        </DialogHeader>
        <div className={cn("min-h-0 overflow-y-auto", quiet && "py-[var(--ui-control-gap)]")}>{children}</div>
        {footer ? <DialogFooter className={cn(quiet && "border-t-0 bg-transparent pt-0")}>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
