import type { ReactNode } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { NavArrowDown, Refresh } from "iconoir-react/regular";

import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
import { cn } from "@/lib/utils";

export function ThemeSettingsCollapsible({
  open,
  onOpenChange,
  title,
  description,
  resetLabel,
  resetDisabled,
  onReset,
  children,
  className,
  groupId,
  typographyGroup,
  markdownElement,
  settingsSection
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  resetLabel?: string;
  resetDisabled?: boolean;
  onReset?: () => void;
  children: ReactNode;
  className?: string;
  groupId?: string;
  typographyGroup?: string;
  markdownElement?: string;
  settingsSection?: string;
}) {
  return (
    <Accordion
      type="multiple"
      value={open ? [ACCORDION_ITEM_VALUE] : []}
      onValueChange={(value) => onOpenChange(value.includes(ACCORDION_ITEM_VALUE))}
      data-theme-settings-accordion
      data-accordion-type="multiple"
    >
      <AccordionItem value={ACCORDION_ITEM_VALUE} asChild>
        <section
          className={cn("editor-ui-surface overflow-hidden bg-background/45", className)}
          data-theme-settings-group={groupId}
          data-typography-group={typographyGroup}
          data-markdown-element={markdownElement}
          data-theme-settings-section={settingsSection}
        >
          <AccordionPrimitive.Header asChild>
            <header className="editor-ui-panel-header flex items-center justify-between gap-3 py-3">
              <AccordionPrimitive.Trigger asChild>
                <button type="button" className="editor-ui-focus flex min-w-0 flex-1 items-center gap-2 text-left" title={description}>
                  <NavArrowDown className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
                  <span className="type-interface-heading min-w-0 truncate text-foreground">{title}</span>
                </button>
              </AccordionPrimitive.Trigger>
              {resetLabel && onReset ? (
                <EditorIconButton context="inline" label={resetLabel} onClick={onReset} disabled={resetDisabled}>
                  <Refresh data-icon />
                </EditorIconButton>
              ) : null}
            </header>
          </AccordionPrimitive.Header>
          <AccordionContent className="pb-0">{children}</AccordionContent>
        </section>
      </AccordionItem>
    </Accordion>
  );
}

const ACCORDION_ITEM_VALUE = "settings";
