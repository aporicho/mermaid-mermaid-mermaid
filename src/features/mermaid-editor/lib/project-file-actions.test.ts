import { describe, expect, it } from "vitest";

import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import {
  initialProjectFileText,
  migrateCurrentProjectFileRef,
  migrateDetachedMarkdownWindows,
  migrateRecentProjectFiles,
  projectFileActionUpdates,
  projectRelativePathFromRuntimePath,
  type ProjectFilePathMigration
} from "@/features/mermaid-editor/lib/project-file-actions";

const migration: ProjectFilePathMigration = {
  sourceAbsolutePath: "/project/docs/spec.md",
  sourceRelativePath: "docs/spec.md",
  sourceName: "spec.md",
  targetFile: { name: "spec.md", path: "/project/archive/spec.md" },
  targetRelativePath: "archive/spec.md"
};

describe("project file actions", () => {
  it("creates valid initial text for every supported project file kind", () => {
    expect(initialProjectFileText("mermaid")).toBe("flowchart LR\n");
    expect(initialProjectFileText("markdown")).toContain("# 未命名文档");
    expect(initialProjectFileText("markdown", "design-notes.md")).toBe("# design-notes\n\n");
    expect(JSON.parse(initialProjectFileText("canvas"))).toMatchObject({ schema: "mmm.canvas", version: 1 });
    expect(initialProjectFileText("csv")).toBe("");
  });

  it("derives relative paths for POSIX and Windows project roots", () => {
    expect(projectRelativePathFromRuntimePath("/project", "/project/archive/spec.md")).toBe("archive/spec.md");
    expect(projectRelativePathFromRuntimePath("C:\\Project", "c:\\project\\archive\\spec.md")).toBe("archive/spec.md");
  });

  it("updates normalized absolute, relative, or name file actions", () => {
    const graph: MermaidGraph = {
      direction: "LR",
      nodes: [
        node("absolute", "/project/docs/spec.md"),
        node("relative", "docs/spec.md"),
        node("name", "spec.md"),
        node("similar", "./docs/spec.md"),
        node("other", "docs/other.md")
      ],
      edges: []
    };

    const updates = projectFileActionUpdates(graph, migration);

    expect(updates.map((update) => update.nodeId)).toEqual(["absolute", "relative", "name", "similar"]);
    expect(updates.every((update) => update.action.kind === "file" && update.action.path === "archive/spec.md")).toBe(true);
    expect(updates[0]?.action).toMatchObject({ tooltip: "absolute tooltip" });
  });

  it("migrates the current file, recent entries, and detached Markdown window without losing edits", () => {
    expect(migrateCurrentProjectFileRef({ name: "spec.md", path: migration.sourceAbsolutePath }, migration)).toEqual(migration.targetFile);
    expect(migrateRecentProjectFiles([
      { name: "spec.md", path: migration.sourceAbsolutePath, openedAt: 8 },
      { name: "other.md", path: "/project/other.md", openedAt: 4 }
    ], migration)).toEqual([
      { name: "spec.md", path: migration.targetFile.path, openedAt: 8 },
      { name: "other.md", path: "/project/other.md", openedAt: 4 }
    ]);

    const windows = migrateDetachedMarkdownWindows([{
      id: "markdown:/project/docs/spec.md",
      file: { name: "spec.md", path: migration.sourceAbsolutePath },
      title: "spec.md",
      value: "unsaved edit",
      savedValue: "saved"
    }], migration);
    expect(windows[0]).toMatchObject({
      id: "markdown:/project/archive/spec.md",
      file: migration.targetFile,
      title: "spec.md",
      value: "unsaved edit",
      savedValue: "saved"
    });
  });
});

function node(id: string, path: string) {
  return {
    id,
    label: id,
    x: 0,
    y: 0,
    fill: "#fff",
    action: { kind: "file" as const, path, openMode: "app-window" as const, tooltip: `${id} tooltip` }
  };
}
