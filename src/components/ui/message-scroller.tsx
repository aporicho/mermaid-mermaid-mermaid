"use client";

import * as React from "react";
import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller";

import { cn } from "@/lib/utils";

const MessageScrollerProvider = MessageScrollerPrimitive.Provider;

function MessageScroller({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return <MessageScrollerPrimitive.Root className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)} {...props} />;
}

function MessageScrollerViewport({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none scrollbar-auto-hide", className)}
      {...props}
    />
  );
}

function MessageScrollerContent({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return <MessageScrollerPrimitive.Content className={cn("mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-6", className)} {...props} />;
}

function MessageScrollerItem({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return <MessageScrollerPrimitive.Item className={cn("[content-visibility:auto] [contain-intrinsic-size:auto_96px]", className)} {...props} />;
}

function MessageScrollerButton({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Button>) {
  return <MessageScrollerPrimitive.Button className={cn("editor-ui-focus absolute bottom-3 right-3 z-10 grid size-8 place-items-center rounded-full bg-card text-foreground shadow-[var(--ui-shadow-toolbar)]", className)} {...props} />;
}

export { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport };
