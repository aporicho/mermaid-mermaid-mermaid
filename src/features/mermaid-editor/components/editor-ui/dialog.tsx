import type { KeyboardEventHandler, ReactNode } from "react";
import { Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const dialogSizeClass = { sm: "max-w-[416px]", md: "max-w-[520px]", lg: "max-w-xl" } as const;

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
        className={cn("grid grid-rows-[auto_minmax(0,1fr)_auto]", dialogSizeClass[size], className)}
        onEscapeKeyDown={(event) => { if (!dismissible) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (!dismissible) event.preventDefault(); }}
        onKeyDown={onKeyDown}
      >
        <header className={cn(
          "editor-ui-panel-header flex min-w-0 items-start justify-between gap-3",
          quiet && "min-h-0 border-b-0 pb-0 pt-[var(--theme-panel-padding)]"
        )}>
          <div className="flex min-w-0 items-start gap-2">{icon}<div className="min-w-0"><DialogTitle className="type-interface-heading">{title}</DialogTitle>{description ? <DialogDescription className="type-interface-metadata mt-1 text-muted-foreground">{description}</DialogDescription> : null}</div></div>
          {showCloseButton ? <Button size="icon" variant="ghost" className="editor-ui-icon-button shrink-0" onClick={() => onOpenChange(false)} aria-label="关闭"><Xmark /></Button> : null}
        </header>
        <div className={cn(
          "editor-ui-panel-body min-h-0 overflow-y-auto",
          quiet && "py-[var(--ui-control-gap)]"
        )}>{children}</div>
        {footer ? <footer className={cn(
          "editor-ui-panel-footer flex justify-end gap-2",
          quiet && "min-h-0 flex-wrap border-t-0 pb-[var(--theme-panel-padding)] pt-0"
        )}>{footer}</footer> : null}
      </DialogContent>
    </Dialog>
  );
}
