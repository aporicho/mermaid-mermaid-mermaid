import type { ReactNode } from "react";
import { Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const dialogSizeClass = { sm: "max-w-[416px]", md: "max-w-[520px]", lg: "max-w-xl" } as const;

export function EditorDialog({ open, onOpenChange, title, description, icon, children, footer, size = "md", dismissible = true, contained = false, container, className }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof dialogSizeClass;
  dismissible?: boolean;
  contained?: boolean;
  container?: HTMLElement | null;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen || dismissible) onOpenChange(nextOpen); }}>
      <DialogContent
        container={container}
        contained={contained}
        className={cn("grid grid-rows-[auto_minmax(0,1fr)_auto]", dialogSizeClass[size], className)}
        onEscapeKeyDown={(event) => { if (!dismissible) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (!dismissible) event.preventDefault(); }}
      >
        <header className="editor-ui-panel-header flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">{icon}<div className="min-w-0"><DialogTitle className="type-interface-heading">{title}</DialogTitle>{description ? <DialogDescription className="type-interface-metadata mt-1 text-muted-foreground">{description}</DialogDescription> : null}</div></div>
          {dismissible ? <Button size="icon" variant="ghost" className="editor-ui-icon-button shrink-0" onClick={() => onOpenChange(false)} aria-label="关闭"><Xmark /></Button> : null}
        </header>
        <div className="editor-ui-panel-body min-h-0 overflow-y-auto">{children}</div>
        {footer ? <footer className="editor-ui-panel-footer flex justify-end gap-2">{footer}</footer> : null}
      </DialogContent>
    </Dialog>
  );
}
