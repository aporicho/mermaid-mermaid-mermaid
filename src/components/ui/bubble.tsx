import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const bubbleVariants = cva("min-w-0 text-sm leading-6", {
  variants: {
    variant: {
      tinted: "max-w-[min(82%,42rem)] bg-muted px-3.5 py-2.5 text-foreground",
      outline: "max-w-full border border-border/70 bg-card px-3.5 py-2.5",
      ghost: "w-full text-foreground",
      destructive: "max-w-full bg-destructive/10 px-3.5 py-2.5 text-destructive"
    }
  },
  defaultVariants: { variant: "ghost" }
});

function Bubble({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof bubbleVariants>) {
  return <div className={cn(bubbleVariants({ variant }), className)} {...props} />;
}

function BubbleContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 break-words", className)} {...props} />;
}

export { Bubble, BubbleContent };
