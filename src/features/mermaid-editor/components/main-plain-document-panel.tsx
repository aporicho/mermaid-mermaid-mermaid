import { useState } from "react";

import { CsvEditorPanel } from "@/features/mermaid-editor/components/csv-editor-panel";
import { TextEditorPanel } from "@/features/mermaid-editor/components/text-editor-panel";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { CsvHeaderMode } from "@/features/mermaid-editor/lib/csv-document-model";

export function MainPlainDocumentPanel({
  documentKind,
  title,
  path,
  value,
  dirty,
  canUndo,
  canRedo,
  onChange,
  onSave,
  onUndo,
  onRedo
}: {
  documentKind: Extract<DocumentKind, "text" | "csv">;
  title: string;
  path?: string;
  value: string;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [headerMode, setHeaderMode] = useState<CsvHeaderMode>("auto");
  if (documentKind === "text") {
    return <TextEditorPanel title={title} path={path} value={value} dirty={dirty} showHeader={false} onChange={onChange} onSave={onSave} />;
  }
  return (
    <CsvEditorPanel
      title={title}
      path={path}
      value={value}
      dirty={dirty}
      showHeader={false}
      headerMode={headerMode}
      canUndo={canUndo}
      canRedo={canRedo}
      onHeaderModeChange={setHeaderMode}
      onChange={onChange}
      onSave={onSave}
      onUndo={onUndo}
      onRedo={onRedo}
    />
  );
}
