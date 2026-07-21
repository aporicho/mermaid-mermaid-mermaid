import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EditorList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="list" className={cn("grid gap-0.5", className)} {...props} />;
}

export function EditorListRow({ icon, title, tooltip, description, trailing, selected, className, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  icon?: ReactNode;
  title: ReactNode;
  tooltip?: string;
  description?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
}) {
  return <div role="listitem"><Button variant="ghost" title={tooltip} className={cn("h-auto min-h-[var(--ui-control-height-sm)] w-full justify-start gap-2 px-2 py-1.5 text-left", selected && "bg-accent text-accent-foreground", className)} aria-current={selected ? "true" : undefined} {...props}>{icon}<span className="min-w-0 flex-1"><span className="type-interface-menu block truncate">{title}</span>{description ? <span className="type-interface-metadata block truncate text-muted-foreground">{description}</span> : null}</span>{trailing}</Button></div>;
}
