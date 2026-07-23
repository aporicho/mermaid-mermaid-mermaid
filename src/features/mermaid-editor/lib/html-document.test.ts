import { describe, expect, it } from "vitest";

import {
  htmlDocumentActionForProjectFile,
  htmlDocumentNodeForProjectFile,
  htmlDocumentProjectFileForRuntimeFile,
  htmlProjectFiles,
  initialHtmlDocumentSource,
  isHtmlDocumentFilePath,
  normalizeNewHtmlFileName,
  resolveHtmlDocumentFile,
  runtimeFilePathToUrl
} from "@/features/mermaid-editor/lib/html-document";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

const workspace: ProjectWorkspace = {
  rootName: "project",
  rootPath: "/project",
  files: [],
  resources: [
    { kind: "file", name: "index.html", path: "/project/web/index.html", relativePath: "web/index.html", modifiedAt: 8 },
    { kind: "file", name: "readme.txt", path: "/project/readme.txt", relativePath: "readme.txt" }
  ],
  scannedAt: 1
};

describe("HTML document nodes", () => {
  it("recognizes HTML and HTM files without adding them to DocumentKind", () => {
    expect(isHtmlDocumentFilePath("index.HTML")).toBe(true);
    expect(isHtmlDocumentFilePath("legacy.htm")).toBe(true);
    expect(isHtmlDocumentFilePath("template.md")).toBe(false);
    expect(htmlProjectFiles(workspace)).toEqual([
      { name: "index.html", path: "/project/web/index.html", relativePath: "web/index.html", modifiedAt: 8 }
    ]);
  });

  it("creates and resolves stable project-relative file actions", () => {
    const file = htmlProjectFiles(workspace)[0]!;
    const action = htmlDocumentActionForProjectFile(file);
    expect(action).toMatchObject({ kind: "file", path: "web/index.html", openMode: "app-window" });
    expect(resolveHtmlDocumentFile("web/index.html", "/project/diagram.mmd", workspace)).toEqual(file);
    expect(htmlDocumentNodeForProjectFile([
      { id: "H", label: "Home", x: 0, y: 0, fill: "#fff", action }
    ], file)?.id).toBe("H");
  });

  it("maps runtime files, safe names, starter source, and platform paths", () => {
    expect(htmlDocumentProjectFileForRuntimeFile({ name: "index.html", path: "/project/web/index.html" }, workspace)).toEqual(htmlProjectFiles(workspace)[0]);
    expect(normalizeNewHtmlFileName("prototype")).toBe("prototype.html");
    expect(normalizeNewHtmlFileName("prototype.css")).toBe("");
    expect(initialHtmlDocumentSource("prototype.html")).toContain("<title>prototype</title>");
    expect(runtimeFilePathToUrl("/project/web/a page.html")).toBe("file:///project/web/a%20page.html");
    expect(runtimeFilePathToUrl("C:\\Project\\index.html")).toBe("file:///C:/Project/index.html");
  });
});
