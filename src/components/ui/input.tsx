import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "editor-ui-control editor-ui-focus type-interface-control flex w-full border-input bg-background file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-[var(--ui-disabled-opacity)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
