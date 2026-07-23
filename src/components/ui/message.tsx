import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const messageVariants = cva("flex w-full min-w-0 gap-3", {
  variants: {
    align: {
      start: "justify-start",
      end: "justify-end"
    }
  },
  defaultVariants: { align: "start" }
});

function Message({ className, align, ...props }: React.ComponentProps<"article"> & VariantProps<typeof messageVariants>) {
  return <article className={cn(messageVariants({ align }), className)} {...props} />;
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 max-w-full flex-col gap-2", className)} {...props} />;
}

function MessageHeader({ className, ...props }: React.ComponentProps<"header">) {
  return <header className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)} {...props} />;
}

function MessageFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return <footer className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)} {...props} />;
}

export { Message, MessageContent, MessageFooter, MessageHeader };
