import type { HTMLAttributes, ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function EditorNotice({ tone = "neutral", icon, title, description, actions, className, ...props }: HTMLAttributes<HTMLDivElement> & {
  tone?: "neutral" | "danger" | "accent";
  icon?: ReactNode;
  title?: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return <Alert
    variant={tone === "danger" ? "destructive" : tone === "accent" ? "info" : "default"}
    role={tone === "danger" ? "alert" : "status"}
    className={cn(actions && "grid-cols-[auto_minmax(0,1fr)_auto]", className)}
    {...props}
  >
    {icon}
    <div className="min-w-0">
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{description}</AlertDescription>
    </div>
    {actions ? <div className="col-start-3 row-start-1">{actions}</div> : null}
  </Alert>;
}

export function EditorEmptyState({ icon, title, description, actions, className, ...props }: HTMLAttributes<HTMLDivElement> & { icon?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <Empty className={cn("min-h-32", className)} {...props}>
    {icon ? <EmptyMedia>{icon}</EmptyMedia> : null}
    <EmptyHeader>
      <EmptyTitle>{title}</EmptyTitle>
      {description ? <EmptyDescription>{description}</EmptyDescription> : null}
    </EmptyHeader>
    {actions ? <EmptyContent>{actions}</EmptyContent> : null}
  </Empty>;
}

export function EditorStatusBadge(props: React.ComponentProps<typeof Badge>) {
  return <Badge {...props} />;
}
