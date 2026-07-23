"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SidebarContextValue = { open: boolean; setOpen: (open: boolean) => void; toggle: () => void };
const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function SidebarProvider({ open, onOpenChange, className, children, ...props }: React.ComponentProps<"div"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const value = React.useMemo(() => ({ open, setOpen: onOpenChange, toggle: () => onOpenChange(!open) }), [onOpenChange, open]);
  return <SidebarContext.Provider value={value}><div className={cn("group/sidebar-wrapper flex min-h-0 min-w-0", className)} data-sidebar-open={open ? "true" : "false"} {...props}>{children}</div></SidebarContext.Provider>;
}

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside SidebarProvider.");
  return context;
}

function Sidebar({ className, ...props }: React.ComponentProps<"aside">) {
  const { open } = useSidebar();
  return <aside aria-hidden={!open} inert={!open ? true : undefined} className={cn("min-h-0 shrink-0 overflow-hidden border-r bg-muted/25 transition-[width,opacity] duration-200", open ? "w-[var(--agent-sidebar-width)] opacity-100" : "w-0 opacity-0", className)} {...props} />;
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 border-b p-3", className)} {...props} />;
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-2 scrollbar-auto-hide", className)} {...props} />;
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("border-t p-2", className)} {...props} />;
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("mb-4", className)} {...props} />;
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-2 py-1 text-[11px] font-medium text-muted-foreground", className)} {...props} />;
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-0.5", className)} {...props} />;
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return <main className={cn("min-h-0 min-w-0 flex-1", className)} {...props} />;
}

export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarProvider, useSidebar };
