import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("type-interface-status inline-flex min-h-5 items-center border-[length:var(--ui-border-width)] px-1.5", {
  variants: {
    tone: {
      neutral: "border-border bg-muted text-muted-foreground",
      accent: "border-primary/30 bg-primary/10 text-primary",
      danger: "border-destructive/30 bg-destructive/10 text-destructive"
    }
  },
  defaultVariants: { tone: "neutral" }
});

function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
