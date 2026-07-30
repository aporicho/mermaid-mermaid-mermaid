import { describe, expect, it, vi } from "vitest";

import { markdownImageAssetsForDocument } from "@/features/mermaid-editor/components/mermaid-editor/markdown-image-assets";
import type { EditorRuntime, RuntimeImageAssetResult } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

const workspace: ProjectWorkspace = {
  rootName: "project",
  rootPath: "/work/project",
  scannedAt: 1,
  files: [],
  resources: []
};

describe("markdown image assets", () => {
  it("persists uploads in project scope and refreshes copied assets", async () => {
    const harness = createHarness({ status: "ready", src: "../assets/notes/cover.png", displaySrc: "mmm-asset://cover", copied: true });
    const actions = markdownImageAssetsForDocument(harness.dependencies, { name: "notes.md", path: "/work/project/docs/notes.md" });
    const file = new File(["image"], "cover.png", { type: "image/png" });

    await expect(actions.onUpload(file)).resolves.toBe("../assets/notes/cover.png");
    expect(harness.importImageAssetFile).toHaveBeenCalledWith(
      { name: "notes.md", path: "/work/project/docs/notes.md" },
      file,
      { projectRoot: "/work/project", rootFallback: true, storageScope: "project" }
    );
    expect(harness.refreshProjectWorkspace).toHaveBeenCalledWith("/work/project");
    expect(harness.onStatus).toHaveBeenLastCalledWith("已复制并插入 cover.png。");
  });

  it("references an existing project image without refreshing the tree", async () => {
    const harness = createHarness({ status: "ready", src: "../assets/cover.png", displaySrc: "mmm-asset://cover", copied: false });
    const actions = markdownImageAssetsForDocument(harness.dependencies, { name: "notes.md", path: "/work/project/docs/notes.md" });

    await expect(actions.insertProjectImage({
      name: "cover.png",
      path: "/work/project/assets/cover.png",
      relativePath: "assets/cover.png"
    })).resolves.toBe("../assets/cover.png");
    expect(harness.refreshProjectWorkspace).not.toHaveBeenCalled();
    expect(harness.onStatus).toHaveBeenLastCalledWith("已引用 cover.png。");
  });

  it("uses the runtime display proxy without rewriting unresolved or unsaved sources", async () => {
    const harness = createHarness({ status: "cancelled" });
    harness.resolveImageAssetSrc.mockResolvedValue("mmm-asset://local/cover.png");
    const saved = markdownImageAssetsForDocument(harness.dependencies, { name: "notes.md", path: "/work/project/notes.md" });
    const unsaved = markdownImageAssetsForDocument(harness.dependencies, null);

    await expect(saved.resolveDisplaySrc("assets/cover.png")).resolves.toBe("mmm-asset://local/cover.png");
    await expect(unsaved.resolveDisplaySrc("https://example.com/cover.png")).resolves.toBe("https://example.com/cover.png");
  });

  it("rejects local insertion before the Markdown document is saved", async () => {
    const harness = createHarness({ status: "cancelled" });
    const actions = markdownImageAssetsForDocument(harness.dependencies, null);

    await expect(actions.onUpload(new File(["image"], "cover.png", { type: "image/png" })))
      .rejects.toThrow("请先保存 Markdown 文档");
    expect(harness.importImageAssetFile).not.toHaveBeenCalled();
    expect(harness.onStatus).toHaveBeenCalledWith("请先保存 Markdown 文档，再插入本地图片。");
  });
});

function createHarness(result: RuntimeImageAssetResult) {
  const importImageAssetFile = vi.fn(async () => result);
  const importImageAssetPath = vi.fn(async () => result);
  const resolveImageAssetSrc = vi.fn(async (_file, src: string) => src);
  const refreshProjectWorkspace = vi.fn(async () => undefined);
  const onStatus = vi.fn();
  const onError = vi.fn();
  return {
    importImageAssetFile,
    importImageAssetPath,
    resolveImageAssetSrc,
    refreshProjectWorkspace,
    onStatus,
    dependencies: {
      runtime: { importImageAssetFile, importImageAssetPath, resolveImageAssetSrc } as unknown as EditorRuntime,
      projectWorkspace: workspace,
      refreshProjectWorkspace,
      onStatus,
      onError
    }
  };
}
