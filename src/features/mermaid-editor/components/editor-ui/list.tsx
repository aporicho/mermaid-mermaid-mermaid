import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { withDataIcon } from "./icon-slot";

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
  return <div role="listitem"><Button variant={selected ? "secondary" : "ghost"} size="sm" title={tooltip} className={cn("h-auto w-full justify-start text-left", className)} aria-current={selected ? "true" : undefined} {...props}>{withDataIcon(icon)}<span className="min-w-0 flex-1"><span className="type-interface-menu block truncate">{title}</span>{description ? <span className="type-interface-metadata block truncate text-muted-foreground">{description}</span> : null}</span>{trailing}</Button></div>;
}
