import { TableRows } from "iconoir-react/regular";

import { ProjectDocumentNodeDialog } from "@/features/mermaid-editor/components/project-document-node-dialog";
import { CSV_TABLE_DEFAULT_FILE_NAME, csvTableProjectFiles } from "@/features/mermaid-editor/lib/csv-table-document";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export function CsvTableDialog({
  projectWorkspace,
  creating,
  existingCollision,
  onClose,
  onSelect,
  onCreate,
  onUseExistingCollision
}: {
  projectWorkspace: ProjectWorkspace | null;
  creating: boolean;
  existingCollision: ProjectFileEntry | null;
  onClose: () => void;
  onSelect: (file: ProjectFileEntry) => void;
  onCreate: (fileName: string) => void;
  onUseExistingCollision: () => void;
}) {
  return (
    <ProjectDocumentNodeDialog
      title="CSV 表格"
      files={csvTableProjectFiles(projectWorkspace)}
      projectAvailable={Boolean(projectWorkspace)}
      creating={creating}
      existingCollision={existingCollision}
      initialFileName={CSV_TABLE_DEFAULT_FILE_NAME}
      fileNamePlaceholder="data.csv"
      searchPlaceholder="搜索 CSV 表格"
      emptyTitle="没有匹配的 CSV 表格"
      fileIcon={<TableRows />}
      onClose={onClose}
      onSelect={onSelect}
      onCreate={onCreate}
      onUseExistingCollision={onUseExistingCollision}
    />
  );
}
