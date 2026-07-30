import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { WarningTriangle } from "iconoir-react/regular";

import { ScrollArea } from "@/components/ui/scroll-area";
import { EditorConfirmDialog } from "@/features/mermaid-editor/components/editor-ui";
import type { RuntimeMarkdownExportResult, RuntimeMarkdownExportWarning } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";

type ExplorerMarkdownExportContextValue = {
  busyPath: string | null;
  exportFile: (file: ProjectFileEntry) => Promise<void>;
};

type ExportWarningFeedback = {
  directoryPath: string;
  fileName: string;
  warnings: RuntimeMarkdownExportWarning[];
};

const ExplorerMarkdownExportContext = createContext<ExplorerMarkdownExportContextValue | null>(null);

export function ExplorerMarkdownExportProvider({ onExport, onStatus, children }: {
  onExport?: (file: ProjectFileEntry) => Promise<RuntimeMarkdownExportResult>;
  onStatus: (message: string) => void;
  children: ReactNode;
}) {
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ExportWarningFeedback | null>(null);
  const exportFile = useCallback(async (file: ProjectFileEntry) => {
    if (busyPath || !onExport) return;
    setBusyPath(file.path);
    try {
      const result = await onExport(file);
      if (result.status === "cancelled") return;
      if (result.status !== "exported") {
        onStatus(result.message);
        return;
      }
      onStatus(`已导出 ${file.name} 和 ${result.copiedFiles} 个资源到 ${result.directoryPath}。`);
      if (result.warnings.length) {
        setFeedback({ directoryPath: result.directoryPath, fileName: file.name, warnings: result.warnings });
      }
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Markdown 导出失败。");
    } finally {
      setBusyPath(null);
    }
  }, [busyPath, onExport, onStatus]);
  const value = useMemo(() => ({ busyPath, exportFile }), [busyPath, exportFile]);

  if (!onExport) return children;

  return (
    <ExplorerMarkdownExportContext.Provider value={value}>
      {children}
      {feedback ? (
        <EditorConfirmDialog
          open
          title="文档已导出，部分资源未复制"
          description={`${feedback.fileName} 已导出到 ${feedback.directoryPath}`}
          icon={<WarningTriangle className="text-icon" />}
          actions={[{ id: "close", label: "知道了", tone: "primary" }]}
          primaryActionId="close"
          cancelActionId="close"
          onAction={() => setFeedback(null)}
        >
          <ScrollArea className="max-h-56 pr-3">
            <ul className="flex flex-col gap-2" aria-label="未导出的资源">
              {feedback.warnings.map((warning, index) => (
                <li key={`${index}:${warning.reference}`} className="type-interface-body min-w-0">
                  <div className="truncate" title={warning.reference}>{warning.reference}</div>
                  <div className="text-muted-foreground">{warning.reason}</div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </EditorConfirmDialog>
      ) : null}
    </ExplorerMarkdownExportContext.Provider>
  );
}

export function useExplorerMarkdownExport() {
  return useContext(ExplorerMarkdownExportContext);
}
