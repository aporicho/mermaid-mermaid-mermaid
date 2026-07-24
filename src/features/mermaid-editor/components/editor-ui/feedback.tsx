import type { HTMLAttributes, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function EditorNotice({ tone = "neutral", icon, title, description, actions, className, ...props }: HTMLAttributes<HTMLDivElement> & {
  tone?: "neutral" | "danger" | "accent";
  icon?: ReactNode;
  title?: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("editor-ui-surface flex items-start gap-3 p-3", tone === "danger" && "border-destructive/30", tone === "accent" && "border-primary/30", className)} {...props}>{icon}<div className="min-w-0 flex-1">{title ? <div className="type-interface-heading">{title}</div> : null}<div className="type-interface-status text-muted-foreground">{description}</div></div>{actions}</div>;
}

export function EditorEmptyState({ icon, title, description, actions, className, ...props }: HTMLAttributes<HTMLDivElement> & { icon?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <div className={cn("grid min-h-32 place-items-center px-6 text-center", className)} {...props}><div className="grid justify-items-center gap-2">{icon}<div className="type-interface-heading">{title}</div>{description ? <div className="type-interface-metadata max-w-sm text-muted-foreground">{description}</div> : null}{actions}</div></div>;
}

export function EditorStatusBadge(props: React.ComponentProps<typeof Badge>) {
  return <Badge {...props} />;
}
