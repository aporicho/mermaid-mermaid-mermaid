import { CodeBrackets } from "iconoir-react/regular";

import { ProjectDocumentNodeDialog } from "@/features/mermaid-editor/components/project-document-node-dialog";
import { htmlProjectFiles } from "@/features/mermaid-editor/lib/html-document";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export function HtmlDocumentDialog({
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
      title="HTML 文件"
      files={htmlProjectFiles(projectWorkspace)}
      projectAvailable={Boolean(projectWorkspace)}
      creating={creating}
      existingCollision={existingCollision}
      initialFileName="index.html"
      fileNamePlaceholder="prototype.html"
      searchPlaceholder="搜索 HTML 文件"
      emptyTitle="没有匹配的 HTML 文件"
      fileIcon={<CodeBrackets />}
      onClose={onClose}
      onSelect={onSelect}
      onCreate={onCreate}
      onUseExistingCollision={onUseExistingCollision}
    />
  );
}
