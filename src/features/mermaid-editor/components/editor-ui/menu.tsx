import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const EditorMenuSurface = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function EditorMenuSurface({ className, ...props }, ref) {
  return <div ref={ref} className={cn("grid gap-0.5", className)} {...props} />;
});

export function EditorMenuSection({ label, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { label?: ReactNode }) {
  return <div className={cn("grid gap-0.5 py-1", className)} {...props}>{label ? <div className="type-interface-metadata px-2 py-1 text-muted-foreground">{label}</div> : null}{children}</div>;
}

export function EditorMenuItem({ icon, label, description, trailing, danger, className, ...props }: ButtonProps & { icon?: ReactNode; label: ReactNode; description?: ReactNode; trailing?: ReactNode; danger?: boolean }) {
  return <Button variant="ghost" className={cn("min-h-[var(--ui-control-height-sm)] h-auto w-full justify-start gap-2 px-2 py-1.5 text-left", danger && "hover:bg-destructive/10 hover:text-destructive", className)} {...props}>{icon}<span className="min-w-0 flex-1"><span className="type-interface-menu block truncate">{label}</span>{description ? <span className="type-interface-metadata block truncate text-muted-foreground">{description}</span> : null}</span>{trailing}</Button>;
}

export function EditorMenuToggleItem({ checked, onCheckedChange, icon, label, disabled, className }: { checked: boolean; onCheckedChange: (checked: boolean) => void; icon?: ReactNode; label: ReactNode; disabled?: boolean; className?: string }) {
  return <EditorMenuItem icon={icon} label={label} disabled={disabled} className={className} onClick={() => onCheckedChange(!checked)} aria-pressed={checked} trailing={<span aria-hidden className={cn("relative h-4 w-7 bg-muted transition-colors", checked && "border-primary bg-primary")} style={{ borderWidth: "var(--ui-border-width)" }}><span className={cn("absolute left-0.5 top-0.5 h-2.5 w-2.5 bg-foreground transition-transform", checked && "translate-x-3 bg-primary-foreground")} /></span>} />;
}
