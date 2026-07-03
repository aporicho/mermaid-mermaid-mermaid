import { describe, expect, it } from "vitest";

import { resolveContentPluginCardsFromText } from "@/features/mermaid-editor/lib/content-plugins/registry";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";

describe("xiaohongshu content plugin", () => {
  it("turns pasted xiaohongshu links into link card drafts", async () => {
    const sourceUrl = "https://www.xiaohongshu.com/explore/abc?xsec_token=token=&xsec_source=pc_search";
    const runtime = {
      resolveLinkPreview: async () => ({
        status: "ready" as const,
        provider: "小红书",
        sourceUrl,
        canonicalUrl: "https://www.xiaohongshu.com/explore/abc",
        title: "周末探店",
        cover: { src: "assets/demo/cover.jpg", persistent: true }
      })
    } as unknown as EditorRuntime;

    const cards = await resolveContentPluginCardsFromText(`看这个 ${sourceUrl}`, { runtime, fileRef: null });

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      label: "周末探店",
      action: { kind: "url", url: sourceUrl, openMode: "app-browser" },
      preview: {
        kind: "link-card",
        pluginId: "xiaohongshu",
        provider: "小红书",
        sourceUrl,
        canonicalUrl: "https://www.xiaohongshu.com/explore/abc",
        title: "周末探店",
        cover: { src: "assets/demo/cover.jpg", persistent: true },
        status: "ready"
      }
    });
  });

  it("falls back to a clickable card when metadata is unavailable", async () => {
    const runtime = {
      resolveLinkPreview: async () => ({ status: "unsupported" as const, message: "unsupported" })
    } as unknown as EditorRuntime;

    const cards = await resolveContentPluginCardsFromText("https://www.xiaohongshu.com/explore/abc", { runtime, fileRef: null });

    expect(cards[0]).toMatchObject({
      action: { kind: "url", url: "https://www.xiaohongshu.com/explore/abc" },
      preview: { provider: "小红书", title: "小红书笔记", status: "fallback" }
    });
  });
});
