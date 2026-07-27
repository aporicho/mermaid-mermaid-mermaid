"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({ className, orientation = "horizontal", ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" data-orientation={orientation} className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)} orientation={orientation} {...props} />
}

const tabsListVariants = cva("group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:min-h-[calc(var(--ui-control-height-md)+6px)] group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none", { variants: { variant: { default: "bg-muted", line: "gap-1 bg-transparent" } }, defaultVariants: { variant: "default" } })

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>>(
  ({ className, variant = "default", ...props }, ref) => <TabsPrimitive.List ref={ref} data-slot="tabs-list" data-variant={variant} className={cn(tabsListVariants({ variant }), className)} {...props} />
)
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Trigger ref={ref} data-slot="tabs-trigger" className={cn("type-interface-control relative inline-flex min-h-[var(--ui-control-height-md)] flex-1 items-center justify-center gap-[var(--ui-control-gap)] rounded-md border border-transparent px-[var(--ui-control-padding-x)] py-[var(--ui-control-padding-y)] whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[length:var(--ui-focus-ring-width)] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-[var(--ui-disabled-opacity)] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start data-active:bg-background data-active:text-foreground data-active:shadow-[var(--ui-shadow-control)] group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:shadow-none after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:-bottom-[5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[var(--ui-icon-size-button)]", className)} {...props} />
)
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} data-slot="tabs-content" className={cn("min-h-0 flex-1 outline-none", className)} {...props} />
)
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
