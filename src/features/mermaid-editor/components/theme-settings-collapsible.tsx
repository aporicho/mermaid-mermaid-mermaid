import type { ReactNode } from "react";
import { Refresh } from "iconoir-react/regular";

import { EditorIconButton, SettingsAccordionCard } from "@/features/mermaid-editor/components/editor-ui";

export function ThemeSettingsCollapsible({
  value,
  title,
  description,
  resetLabel,
  resetDisabled,
  onReset,
  children,
  className,
  groupId,
  typographyGroup,
  markdownCategory,
  markdownElement,
  settingsSection
}: {
  value: string;
  title: string;
  description?: string;
  resetLabel?: string;
  resetDisabled?: boolean;
  onReset?: () => void;
  children: ReactNode;
  className?: string;
  groupId?: string;
  typographyGroup?: string;
  markdownCategory?: string;
  markdownElement?: string;
  settingsSection?: string;
}) {
  return (
    <SettingsAccordionCard
      value={value}
      title={title}
      description={description}
      className={className}
      controlAction={resetLabel && onReset ? (
        <EditorIconButton context="inline" variant="outline" label={resetLabel} onClick={onReset} disabled={resetDisabled}>
          <Refresh data-icon />
        </EditorIconButton>
      ) : null}
      itemProps={{
        "data-theme-settings-group": groupId,
        "data-typography-group": typographyGroup,
        "data-markdown-category": markdownCategory,
        "data-markdown-element": markdownElement,
        "data-theme-settings-section": settingsSection
      } as Record<string, string | undefined>}
    >
      {children}
    </SettingsAccordionCard>
  );
}
