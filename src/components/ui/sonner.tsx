import type { ComponentProps } from "react";
import { CheckCircle, InfoCircle, RefreshDouble, WarningTriangle, XmarkCircle } from "iconoir-react/regular";
import { Toaster as Sonner } from "sonner";

import { cn } from "@/lib/utils";

type ToasterProps = ComponentProps<typeof Sonner>;

function Toaster({ theme = "system", ...props }: ToasterProps) {
  const iconClass = "editor-ui-icon";
  return (
    <Sonner
      data-slot="toaster"
      theme={theme}
      className="toaster group"
      icons={{
        success: <CheckCircle className={iconClass} />,
        info: <InfoCircle className={iconClass} />,
        warning: <WarningTriangle className={iconClass} />,
        error: <XmarkCircle className={iconClass} />,
        loading: <RefreshDouble className={cn(iconClass, "animate-spin")} />
      }}
      toastOptions={{
        classNames: {
          toast: "type-interface-body group toast rounded-lg border border-border bg-popover text-popover-foreground shadow-[var(--ui-shadow-popover)]",
          title: "type-interface-heading",
          description: "type-interface-status text-muted-foreground",
          actionButton: "rounded-md bg-primary text-primary-foreground",
          cancelButton: "rounded-md bg-muted text-muted-foreground"
        }
      }}
      {...props}
    />
  );
}

export { Toaster };
