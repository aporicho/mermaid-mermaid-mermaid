"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>>(
  ({ className, defaultValue, value, min = 0, max = 100, ...props }, ref) => {
    const values = React.useMemo(() => Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min], [value, defaultValue, min])
    return (
      <SliderPrimitive.Root ref={ref} data-slot="slider" defaultValue={defaultValue} value={value} min={min} max={max} className={cn("relative flex w-full touch-none items-center select-none data-disabled:opacity-[var(--ui-disabled-opacity)] data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col", className)} {...props}>
        <SliderPrimitive.Track data-slot="slider-track" className="relative grow overflow-hidden rounded-full bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1">
          <SliderPrimitive.Range data-slot="slider-range" className="absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full" />
        </SliderPrimitive.Track>
        {Array.from({ length: values.length }, (_, index) => <SliderPrimitive.Thumb data-slot="slider-thumb" key={index} className="relative block size-[calc(var(--ui-icon-size-button)*.75)] shrink-0 rounded-full border-[length:var(--ui-border-width)] border-ring bg-background ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-[length:var(--ui-focus-ring-width)] focus-visible:ring-[length:var(--ui-focus-ring-width)] focus-visible:outline-hidden active:ring-[length:var(--ui-focus-ring-width)] disabled:pointer-events-none disabled:opacity-[var(--ui-disabled-opacity)]" />)}
      </SliderPrimitive.Root>
    )
  }
)
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
