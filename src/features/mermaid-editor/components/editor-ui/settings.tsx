import type { ComponentProps, ReactNode } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { NavArrowDown, NavArrowUp } from "iconoir-react/regular";

import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type MultipleAccordionProps = Omit<Extract<ComponentProps<typeof Accordion>, { type: "multiple" }>, "type">;

export function SettingsAccordion({ className, ...props }: MultipleAccordionProps) {
  return (
    <Accordion
      type="multiple"
      className={cn("gap-3", className)}
      data-settings-accordion
      data-accordion-type="multiple"
      {...props}
    />
  );
}

export function SettingsAccordionCard({
  value,
  title,
  description,
  triggerAriaLabel,
  action,
  controlAction,
  children,
  className,
  contentClassName,
  itemProps
}: {
  value: string;
  title: ReactNode;
  description?: string;
  triggerAriaLabel?: string;
  action?: ReactNode;
  controlAction?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  itemProps?: Omit<ComponentProps<typeof AccordionItem>, "children" | "className" | "value">;
}) {
  const collapseLabel = triggerAriaLabel ?? (typeof title === "string" ? `折叠或展开${title}` : "折叠或展开设置");

  return (
    <AccordionItem value={value} className="not-last:border-b-0" {...itemProps}>
      <Card size="sm" className={cn("gap-0", className)} data-settings-accordion-card>
        <CardHeader
          className="items-center"
          data-settings-accordion-header
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof Element) || target.closest("[data-settings-accordion-control]")) return;
            event.currentTarget.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click();
          }}
        >
          <CardTitle className="min-w-0 truncate" title={description}>{title}</CardTitle>
          <CardAction className="row-span-1 flex items-center gap-2 self-center" data-settings-accordion-control>
            {action}
            <AccordionPrimitive.Header className="flex">
              <ButtonGroup>
                <AccordionPrimitive.Trigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="group/settings-accordion-trigger"
                    aria-label={collapseLabel}
                    title={collapseLabel}
                  >
                    <NavArrowDown
                      aria-hidden
                      data-icon
                      className="group-data-[state=open]/settings-accordion-trigger:hidden"
                    />
                    <NavArrowUp
                      aria-hidden
                      data-icon
                      className="hidden group-data-[state=open]/settings-accordion-trigger:block"
                    />
                  </Button>
                </AccordionPrimitive.Trigger>
                {controlAction}
              </ButtonGroup>
            </AccordionPrimitive.Header>
          </CardAction>
        </CardHeader>
        <AccordionContent className="pb-px">
          <CardContent className={cn("pt-(--card-spacing)", contentClassName)}>{children}</CardContent>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}

export function SettingsTabs({ className, ...props }: ComponentProps<typeof Tabs>) {
  return (
    <Tabs
      orientation="vertical"
      className={cn(
        "grid min-h-0 min-w-0 flex-1 grid-cols-[148px_minmax(0,1fr)] gap-0 max-[520px]:grid-cols-[120px_minmax(0,1fr)]",
        className
      )}
      {...props}
    />
  );
}

export function SettingsTabsList({ className, children, ...props }: ComponentProps<typeof TabsList>) {
  return (
    <ScrollArea className="h-full min-h-0" data-settings-tabs-navigation>
      <div className="p-2">
        <TabsList variant="line" className={cn("w-full flex-col items-stretch justify-start", className)} {...props}>
          {children}
        </TabsList>
      </div>
    </ScrollArea>
  );
}

export function SettingsTabsBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-h-0 min-w-0", className)} data-settings-tabs-body {...props} />;
}

export function SettingsTabsContent({
  className,
  contentClassName,
  children,
  ...props
}: ComponentProps<typeof TabsContent> & { contentClassName?: string }) {
  return (
    <TabsContent className={cn("m-0 h-full min-w-0", className)} {...props}>
      <ScrollArea className="h-full min-h-0 min-w-0" data-settings-tabs-scroll-area>
        <div className={cn("p-4", contentClassName)}>{children}</div>
      </ScrollArea>
    </TabsContent>
  );
}
