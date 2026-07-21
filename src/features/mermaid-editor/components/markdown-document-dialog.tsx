import { EmptyPage } from "iconoir-react/regular";

import { ProjectDocumentNodeDialog } from "@/features/mermaid-editor/components/project-document-node-dialog";
import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export function MarkdownDocumentDialog({
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
      title="Markdown 文档"
      files={(projectWorkspace?.files || []).filter((file) => isSupportedMarkdownFilePath(file.path))}
      projectAvailable={Boolean(projectWorkspace)}
      creating={creating}
      existingCollision={existingCollision}
      initialFileName="untitled.md"
      fileNamePlaceholder="design.md"
      searchPlaceholder="搜索 Markdown 文档"
      emptyTitle="没有匹配的 Markdown 文档"
      fileIcon={<EmptyPage />}
      onClose={onClose}
      onSelect={onSelect}
      onCreate={onCreate}
      onUseExistingCollision={onUseExistingCollision}
    />
  );
}
