import { useState } from "react";
import { EditPencil, Folder, FolderPlus, Page, PathArrow, Plus, Trash } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EditorDialog, EditorField, EditorList, EditorListRow } from "@/features/mermaid-editor/components/editor-ui";
import type { RuntimeProjectFileKind } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ProjectResourceEntry } from "@/features/mermaid-editor/lib/project-workspace";

type ExplorerProjectFileKind = "markdown" | "mermaid" | "csv" | "html";

type ExplorerCreateProjectFileRequest = {
  directoryPath: string;
  fileName: string;
  kind: RuntimeProjectFileKind;
};

type ExplorerCreateProjectDirectoryRequest = {
  directoryPath: string;
  directoryName: string;
};

const EXPLORER_FILE_KINDS = [
  { kind: "markdown", label: "Markdown", defaultFileName: "document.md", extension: ".md" },
  { kind: "mermaid", label: "Mermaid", defaultFileName: "diagram.mmd", extension: ".mmd" },
  { kind: "csv", label: "CSV", defaultFileName: "table.csv", extension: ".csv" },
  { kind: "html", label: "HTML", defaultFileName: "index.html", extension: ".html" }
] as const satisfies readonly { kind: ExplorerProjectFileKind; label: string; defaultFileName: string; extension: string }[];

export function CreateProjectFileDialog({ directoryPath, rootName, projectBusy, onClose, onCreate }: {
  directoryPath: string;
  rootName: string;
  projectBusy: boolean;
  onClose: () => void;
  onCreate: (request: ExplorerCreateProjectFileRequest) => void;
}) {
  const [kind, setKind] = useState<ExplorerProjectFileKind>("markdown");
  const descriptor = EXPLORER_FILE_KINDS.find((item) => item.kind === kind) ?? EXPLORER_FILE_KINDS[0];
  const [fileName, setFileName] = useState<string>(descriptor.defaultFileName);
  const directoryLabel = projectDirectoryLabel(rootName, directoryPath);

  function selectKind(nextKind: ExplorerProjectFileKind) {
    const currentDescriptor = EXPLORER_FILE_KINDS.find((item) => item.kind === kind) ?? EXPLORER_FILE_KINDS[0];
    const nextDescriptor = EXPLORER_FILE_KINDS.find((item) => item.kind === nextKind) ?? EXPLORER_FILE_KINDS[0];
    setKind(nextKind);
    setFileName((current) => current === currentDescriptor.defaultFileName ? nextDescriptor.defaultFileName : current);
  }

  function submit() {
    const normalizedFileName = ensureExplorerFileName(fileName, descriptor.extension);
    if (!normalizedFileName) return;
    onCreate({ directoryPath, fileName: normalizedFileName, kind });
  }

  return (
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="新建文件"
      description={`位置：${directoryLabel}`}
      size="sm"
      dismissible={!projectBusy}
      footer={<>
        <Button type="button" variant="ghost" onClick={onClose} disabled={projectBusy}>取消</Button>
        <Button type="button" onClick={submit} disabled={projectBusy || !fileName.trim()}><Plus data-icon="inline-start" />新建</Button>
      </>}
    >
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <ToggleGroup
          type="single"
          size="sm"
          value={kind}
          className="w-full justify-stretch"
          aria-label="文件类型"
          disabled={projectBusy}
          onValueChange={(value) => { if (value) selectKind(value as ExplorerProjectFileKind); }}
        >
          {EXPLORER_FILE_KINDS.map((item) => (
            <ToggleGroupItem key={item.kind} type="button" value={item.kind} className="flex-1">
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <EditorField label="文件名" htmlFor="explorer-new-file-name" description={`未填写扩展名时自动添加 ${descriptor.extension}`}>
          <Input
            id="explorer-new-file-name"
            value={fileName}
            placeholder={descriptor.defaultFileName}
            onChange={(event) => setFileName(event.target.value)}
            autoFocus
            disabled={projectBusy}
          />
        </EditorField>
      </form>
    </EditorDialog>
  );
}

export function CreateProjectDirectoryDialog({ directoryPath, rootName, projectBusy, onClose, onCreate }: {
  directoryPath: string;
  rootName: string;
  projectBusy: boolean;
  onClose: () => void;
  onCreate: (request: ExplorerCreateProjectDirectoryRequest) => void;
}) {
  const [directoryName, setDirectoryName] = useState("new-folder");
  const directoryLabel = projectDirectoryLabel(rootName, directoryPath);

  function submit() {
    const normalized = directoryName.trim();
    if (!normalized) return;
    onCreate({ directoryPath, directoryName: normalized });
  }

  return (
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="新建文件夹"
      description={`位置：${directoryLabel}`}
      size="sm"
      dismissible={!projectBusy}
      footer={<>
        <Button type="button" variant="ghost" onClick={onClose} disabled={projectBusy}>取消</Button>
        <Button type="button" onClick={submit} disabled={projectBusy || !directoryName.trim()}><FolderPlus data-icon="inline-start" />新建</Button>
      </>}
    >
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <EditorField label="文件夹名" htmlFor="explorer-new-directory-name">
          <Input id="explorer-new-directory-name" value={directoryName} onChange={(event) => setDirectoryName(event.target.value)} autoFocus disabled={projectBusy} />
        </EditorField>
      </form>
    </EditorDialog>
  );
}

export function RenameProjectResourceDialog({ resource, projectBusy, onClose, onRename }: {
  resource: ProjectResourceEntry;
  projectBusy: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(resource.name);
  const changed = name.trim() && name.trim() !== resource.name;

  function submit() {
    const normalized = name.trim();
    if (!normalized || normalized === resource.name) return;
    onRename(normalized);
  }

  return (
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`重命名 ${resource.name}`}
      description={resource.relativePath || resource.path}
      size="sm"
      dismissible={!projectBusy}
      footer={<>
        <Button type="button" variant="ghost" onClick={onClose} disabled={projectBusy}>取消</Button>
        <Button type="button" onClick={submit} disabled={projectBusy || !changed}><EditPencil data-icon="inline-start" />重命名</Button>
      </>}
    >
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <EditorField label="名称" htmlFor="explorer-rename-resource-name">
          <Input id="explorer-rename-resource-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus disabled={projectBusy} />
        </EditorField>
      </form>
    </EditorDialog>
  );
}

export function DeleteProjectResourcesDialog({ resources, projectBusy, onClose, onDelete }: {
  resources: ProjectResourceEntry[];
  projectBusy: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const title = resources.length === 1 ? `删除 ${resources[0].name}` : `删除 ${resources.length} 项`;
  return (
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={title}
      description="项目资源会移入系统废纸篓。"
      size="sm"
      dismissible={!projectBusy}
      footer={<>
        <Button type="button" variant="ghost" onClick={onClose} disabled={projectBusy}>取消</Button>
        <Button type="button" variant="destructive" onClick={onDelete} disabled={projectBusy}><Trash data-icon="inline-start" />删除</Button>
      </>}
    >
      <EditorList className="max-h-[min(320px,45vh)] overflow-y-auto border p-1" aria-label="待删除资源">
        {resources.map((resource) => (
          <EditorListRow key={resource.path} icon={resource.kind === "directory" ? <Folder /> : <Page />} title={resource.name} description={resource.relativePath || "项目根目录"} tooltip={resource.path} disabled={projectBusy} />
        ))}
      </EditorList>
    </EditorDialog>
  );
}

export function MoveProjectResourcesDialog({
  resources,
  rootName,
  directoryPaths,
  targetDirectoryPath,
  projectBusy,
  onTargetDirectoryPathChange,
  onClose,
  onMove
}: {
  resources: ProjectResourceEntry[];
  rootName: string;
  directoryPaths: string[];
  targetDirectoryPath: string;
  projectBusy: boolean;
  onTargetDirectoryPathChange: (relativePath: string) => void;
  onClose: () => void;
  onMove: () => void;
}) {
  const sourceDirectoryPath = resources.length === 1 ? parentResourceDirectory(resources[0].relativePath) : "";
  const destinationPaths = ["", ...directoryPaths];
  const destinationUnchanged = resources.length === 1 && targetDirectoryPath === sourceDirectoryPath;
  const title = resources.length === 1 ? `移动 ${resources[0].name}` : `移动 ${resources.length} 项`;

  return (
    <EditorDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={title}
      description="选择目标文件夹"
      size="sm"
      dismissible={!projectBusy}
      footer={<>
        <Button type="button" variant="ghost" onClick={onClose} disabled={projectBusy}>取消</Button>
        <Button type="button" onClick={onMove} disabled={projectBusy || destinationUnchanged}><PathArrow data-icon="inline-start" />移动</Button>
      </>}
    >
      <EditorList className="max-h-[min(420px,55vh)] overflow-y-auto border p-1" aria-label="目标文件夹">
        {destinationPaths.map((directoryPath) => (
          <EditorListRow
            type="button"
            key={directoryPath || "root"}
            icon={<Folder />}
            title={directoryPath ? directoryPath.split("/").at(-1) : rootName}
            description={directoryPath || "项目根目录"}
            tooltip={projectDirectoryLabel(rootName, directoryPath)}
            selected={targetDirectoryPath === directoryPath}
            disabled={projectBusy}
            onClick={() => onTargetDirectoryPathChange(directoryPath)}
          />
        ))}
      </EditorList>
    </EditorDialog>
  );
}

function parentResourceDirectory(relativePath: string) {
  const segments = relativePath.replaceAll("\\", "/").split("/");
  segments.pop();
  return segments.join("/");
}

function projectDirectoryLabel(rootName: string, directoryPath: string) {
  return directoryPath ? `${rootName}/${directoryPath}` : rootName;
}

function ensureExplorerFileName(value: string, extension: string) {
  const fileName = value.trim();
  if (!fileName) return "";
  if (fileName.toLocaleLowerCase().endsWith(extension)) return fileName;
  const withoutExtension = fileName.replace(/(?:\.canvas\.json|\.markdown|\.mermaid|\.[^./\\]+)$/i, "");
  return `${withoutExtension || fileName}${extension}`;
}
