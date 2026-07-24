import type { ReactNode } from "react";
import { Refresh } from "iconoir-react/regular";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
          className={cn("overflow-hidden", className)}
          data-theme-settings-group={groupId}
          data-typography-group={typographyGroup}
          data-markdown-element={markdownElement}
          data-theme-settings-section={settingsSection}
        >
          <div className="flex items-center gap-2">
            <AccordionTrigger className="min-w-0 px-3" title={description}>
              <span className="min-w-0 truncate">{title}</span>
            </AccordionTrigger>
            {resetLabel && onReset ? (
              <EditorIconButton context="inline" label={resetLabel} className="mr-2" onClick={onReset} disabled={resetDisabled}>
                <Refresh data-icon />
              </EditorIconButton>
            ) : null}
          </div>
          <AccordionContent className="pb-0">{children}</AccordionContent>
        </section>
      </AccordionItem>
    </Accordion>
  );
}

const ACCORDION_ITEM_VALUE = "settings";
