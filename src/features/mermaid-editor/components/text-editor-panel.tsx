import type { KeyboardEvent } from "react";
import { FloppyDisk, Text } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";

export function TextEditorPanel({ title, path, value, dirty, showHeader = true, onChange, onSave }: {
  title: string;
  path?: string;
  value: string;
  dirty: boolean;
  showHeader?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key.toLowerCase() !== "s" || (!event.ctrlKey && !event.metaKey) || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    onSave();
  }
  return (
    <section className="flex h-full min-h-0 flex-col" onKeyDownCapture={handleKeyDown}>
      {showHeader ? <WorkspaceWindowHeader
        icon={<Text className="editor-ui-icon shrink-0 text-icon" />}
        title={<span className="flex min-w-0 items-center gap-1" title={path || title}><span className="truncate">{title}</span>{dirty ? <span className="size-1.5 shrink-0 bg-foreground/60" aria-hidden /> : null}</span>}
        actions={<ButtonGroup><Button variant="outline" size="icon-sm" aria-label="保存文本文件" onClick={onSave}><FloppyDisk data-icon="inline-start" /></Button></ButtonGroup>}
      /> : null}
      <Textarea className="min-h-0 flex-1 resize-none rounded-none border-0 font-mono shadow-none focus-visible:ring-0" aria-label={`${title} 文本编辑器`} spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} />
    </section>
  );
}
