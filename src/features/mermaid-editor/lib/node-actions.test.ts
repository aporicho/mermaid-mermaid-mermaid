import { describe, expect, it } from "vitest";

import {
  extractNodeActionsFromClipboardText,
  inferNodeActionFromPlainText,
  inferNodeActionKindFromTarget,
  nodeActionSuggestedLabel,
  nodeActionDisplayTooltip,
  normalizeNodeAction
} from "@/features/mermaid-editor/lib/node-actions";

describe("node actions", () => {
  it("infers link kinds from pasted targets", () => {
    expect(inferNodeActionKindFromTarget("https://example.com")).toBe("url");
    expect(inferNodeActionKindFromTarget("./docs/spec.md")).toBe("file");
    expect(inferNodeActionKindFromTarget("file:///C:/docs/spec.mmd")).toBe("file");
    expect(inferNodeActionKindFromTarget("mailto:team@example.com")).toBeUndefined();
  });

  it("uses explicit tooltip before default link copy", () => {
    const urlAction = normalizeNodeAction({ kind: "url", url: "https://example.com", openMode: "app-browser" });
    const fileAction = normalizeNodeAction({ kind: "file", path: "./docs/spec.md", openMode: "app-window", tooltip: "产品说明" });

    expect(nodeActionDisplayTooltip(urlAction)).toBe("打开链接");
    expect(nodeActionDisplayTooltip(fileAction)).toBe("产品说明");
  });

  it("infers node actions from plain node text", () => {
    expect(inferNodeActionFromPlainText(" https://example.com/docs ")).toMatchObject({ kind: "url", url: "https://example.com/docs", openMode: "app-browser" });
    expect(inferNodeActionFromPlainText("docs/spec.md")).toMatchObject({ kind: "file", path: "docs/spec.md", openMode: "app-window" });
    expect(inferNodeActionFromPlainText("read the docs at https://example.com")).toBeUndefined();
  });

  it("extracts clipboard links only when every pasted line is a supported target", () => {
    const actions = extractNodeActionsFromClipboardText("https://example.com\n./docs/spec.md");

    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ kind: "url", url: "https://example.com" });
    expect(actions[1]).toMatchObject({ kind: "file", path: "./docs/spec.md" });
    expect(extractNodeActionsFromClipboardText("https://example.com\nplain note")).toEqual([]);
  });

  it("suggests readable labels for link nodes", () => {
    expect(nodeActionSuggestedLabel(normalizeNodeAction({ kind: "url", url: "https://www.example.com/docs/spec?tab=1", openMode: "app-browser" }))).toBe("example.com/docs/spec");
    expect(nodeActionSuggestedLabel(normalizeNodeAction({ kind: "file", path: "C:\\Users\\me\\notes\\design.md", openMode: "app-window" }))).toBe("design.md");
  });
});
