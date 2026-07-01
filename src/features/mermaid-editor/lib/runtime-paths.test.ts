import { describe, expect, it } from "vitest";

import {
  isAbsoluteRuntimePath,
  joinRuntimePath,
  normalizeProjectRelativePath,
  parentDirectoryPath,
  runtimeFileNameFromPath
} from "@/features/mermaid-editor/lib/runtime-paths";

describe("runtime paths", () => {
  it("derives parent directories and file names from runtime paths", () => {
    expect(parentDirectoryPath("C:\\repo\\docs\\demo.mmd")).toBe("C:\\repo\\docs");
    expect(parentDirectoryPath("/repo/docs/demo.mmd")).toBe("/repo/docs");
    expect(parentDirectoryPath("demo.mmd")).toBeUndefined();
    expect(parentDirectoryPath(undefined)).toBeUndefined();

    expect(runtimeFileNameFromPath("C:\\repo\\docs\\demo.mmd")).toBe("demo.mmd");
    expect(runtimeFileNameFromPath("/repo/docs/readme.md")).toBe("readme.md");
    expect(runtimeFileNameFromPath("")).toBe("document");
  });

  it("detects absolute runtime paths across platforms", () => {
    expect(isAbsoluteRuntimePath("/repo/docs/demo.mmd")).toBe(true);
    expect(isAbsoluteRuntimePath("C:\\repo\\docs\\demo.mmd")).toBe(true);
    expect(isAbsoluteRuntimePath("\\\\server\\share\\demo.mmd")).toBe(true);
    expect(isAbsoluteRuntimePath("docs/demo.mmd")).toBe(false);
  });

  it("joins relative runtime paths with the base separator style", () => {
    expect(joinRuntimePath("C:\\repo\\docs", "nested\\demo.mmd")).toBe("C:\\repo\\docs\\nested\\demo.mmd");
    expect(joinRuntimePath("/repo/docs", "nested/demo.mmd")).toBe("/repo/docs/nested/demo.mmd");
    expect(joinRuntimePath("/repo/docs", "/absolute/demo.mmd")).toBe("/absolute/demo.mmd");
    expect(joinRuntimePath(undefined, "demo.mmd")).toBe("demo.mmd");
  });

  it("normalizes project-relative paths for matching", () => {
    expect(normalizeProjectRelativePath(".\\Docs\\Demo.mmd")).toBe("docs/demo.mmd");
    expect(normalizeProjectRelativePath("./Docs//Demo.mmd")).toBe("docs/demo.mmd");
    expect(normalizeProjectRelativePath(" nested\\Demo.md ")).toBe("nested/demo.md");
  });
});
