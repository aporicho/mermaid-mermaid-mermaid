import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "editor-ui-control editor-ui-focus type-interface-control flex min-h-[80px] w-full border-input bg-background placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-[var(--ui-disabled-opacity)]",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
