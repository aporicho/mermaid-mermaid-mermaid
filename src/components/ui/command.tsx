"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "iconoir-react/regular"

import { cn } from "@/lib/utils"

const Command = React.forwardRef<React.ElementRef<typeof CommandPrimitive>, React.ComponentPropsWithoutRef<typeof CommandPrimitive>>(
  ({ className, ...props }, ref) => <CommandPrimitive ref={ref} className={cn("flex h-full w-full flex-col overflow-hidden bg-popover", className)} {...props} />
)
Command.displayName = CommandPrimitive.displayName

const CommandInput = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Input>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>(
  ({ className, ...props }, ref) => (
    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
      <Search className="mr-2 size-4 shrink-0 text-icon" />
      <CommandPrimitive.Input ref={ref} className={cn("type-interface-control h-10 w-full bg-transparent py-2 outline-none placeholder:text-muted-foreground", className)} {...props} />
    </div>
  )
)
CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<React.ElementRef<typeof CommandPrimitive.List>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>>(
  ({ className, ...props }, ref) => <CommandPrimitive.List ref={ref} className={cn("max-h-72 overflow-y-auto overflow-x-hidden p-1", className)} {...props} />
)
CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Empty>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>>(
  ({ className, ...props }, ref) => <CommandPrimitive.Empty ref={ref} className={cn("type-interface-metadata py-8 text-center text-muted-foreground", className)} {...props} />
)
CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Group>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>>(
  ({ className, ...props }, ref) => <CommandPrimitive.Group ref={ref} className={cn("overflow-hidden text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:[font-family:var(--type-interface-metadata-family)] [&_[cmdk-group-heading]]:[font-size:var(--type-interface-metadata-size)] [&_[cmdk-group-heading]]:[font-weight:var(--type-interface-metadata-weight)] [&_[cmdk-group-heading]]:[letter-spacing:var(--type-interface-metadata-letter-spacing)] [&_[cmdk-group-heading]]:[line-height:var(--type-interface-metadata-line-height)] [&_[cmdk-group-heading]]:text-muted-foreground", className)} {...props} />
)
CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandItem = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Item>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>>(
  ({ className, ...props }, ref) => <CommandPrimitive.Item ref={ref} className={cn("type-interface-menu relative flex min-h-9 cursor-default select-none items-center px-2 py-1.5 outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50", className)} {...props} />
)
CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandSeparator = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>>(
  ({ className, ...props }, ref) => <CommandPrimitive.Separator ref={ref} className={cn("-mx-1 h-px bg-border", className)} {...props} />
)
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator }
