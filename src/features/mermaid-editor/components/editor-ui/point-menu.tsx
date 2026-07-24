import { type ReactNode, type RefObject } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type EditorPointMenuPoint = Readonly<{
  x: number;
  y: number;
}>;

export type EditorPointMenuProps = {
  open: boolean;
  point: EditorPointMenuPoint;
  onOpenChange: (open: boolean) => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  restoreFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * A keyboard-accessible dropdown menu anchored to a viewport coordinate.
 * Useful for pointer-invoked editor menus without giving up Radix focus,
 * dismissal, and collision handling.
 */
export function EditorPointMenu({
  open,
  point,
  onOpenChange,
  ariaLabel,
  children,
  className,
  restoreFocusRef
}: EditorPointMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        aria-hidden
        className="pointer-events-none fixed size-px opacity-0"
        style={{ left: point.x, top: point.y }}
        tabIndex={-1}
      />
      <DropdownMenuContent
        aria-label={ariaLabel}
        align="start"
        className={cn("w-52 p-1", className)}
        collisionPadding={8}
        onCloseAutoFocus={(event) => {
          const focusTarget = restoreFocusRef?.current;
          if (!focusTarget) return;
          event.preventDefault();
          focusTarget.focus({ preventScroll: true });
        }}
        side="right"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
