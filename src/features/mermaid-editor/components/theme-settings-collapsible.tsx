import type { ReactNode } from "react";
import { NavArrowDown, Refresh } from "iconoir-react/regular";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <section
        className={cn("editor-ui-surface overflow-hidden bg-background/45", className)}
        data-theme-settings-group={groupId}
        data-typography-group={typographyGroup}
        data-markdown-element={markdownElement}
        data-theme-settings-section={settingsSection}
      >
        <header className="editor-ui-panel-header flex items-center justify-between gap-3 py-3">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" title={description}>
              <NavArrowDown className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
              <span className="type-interface-heading min-w-0 truncate text-foreground">{title}</span>
            </button>
          </CollapsibleTrigger>
          {resetLabel && onReset ? (
            <EditorIconButton context="inline" label={resetLabel} onClick={onReset} disabled={resetDisabled}>
              <Refresh />
            </EditorIconButton>
          ) : null}
        </header>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
