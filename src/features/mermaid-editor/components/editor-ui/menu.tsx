import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

import { withDataIcon } from "./icon-slot";

export const EditorMenuSurface = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function EditorMenuSurface({ className, ...props }, ref) {
  return <div ref={ref} className={cn("grid gap-0.5", className)} {...props} />;
});

export function EditorMenuSection({ label, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { label?: ReactNode }) {
  return <div className={cn("grid gap-0.5 py-1", className)} {...props}>{label ? <div className="type-interface-metadata px-2 py-1 text-muted-foreground">{label}</div> : null}{children}</div>;
}

export function EditorMenuItem({ icon, label, description, trailing, danger, className, ...props }: ButtonProps & { icon?: ReactNode; label: ReactNode; description?: ReactNode; trailing?: ReactNode; danger?: boolean }) {
  return <Button variant={danger ? "destructive" : "ghost"} size="sm" className={cn("h-auto w-full justify-start text-left", className)} {...props}>{withDataIcon(icon)}<span className="min-w-0 flex-1"><span className="type-interface-menu block truncate">{label}</span>{description ? <span className="type-interface-metadata block truncate text-muted-foreground">{description}</span> : null}</span>{trailing}</Button>;
}

export function EditorMenuToggleItem({ checked, onCheckedChange, icon, label, disabled, className }: { checked: boolean; onCheckedChange: (checked: boolean) => void; icon?: ReactNode; label: ReactNode; disabled?: boolean; className?: string }) {
  return <Toggle pressed={checked} onPressedChange={onCheckedChange} disabled={disabled} size="sm" className={cn("h-auto w-full justify-start text-left", className)}>{withDataIcon(icon)}<span className="type-interface-menu min-w-0 flex-1 truncate">{label}</span></Toggle>;
}
