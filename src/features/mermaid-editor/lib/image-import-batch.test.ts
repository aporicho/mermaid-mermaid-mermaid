import { describe, expect, it, vi } from "vitest";

import {
  importImageBatch,
  type ImageImportBatchInput
} from "@/features/mermaid-editor/lib/image-import-batch";
import type { RuntimeImageAssetResult } from "@/features/mermaid-editor/lib/editor-runtime";

describe("image import batch", () => {
  it("imports concurrently and keeps ready results in input order", async () => {
    const first = deferred<RuntimeImageAssetResult>();
    const second = deferred<RuntimeImageAssetResult>();
    const third = deferred<RuntimeImageAssetResult>();
    const promises = new Map([
      ["first", first.promise],
      ["second", second.promise],
      ["third", third.promise]
    ]);
    const importer = vi.fn((input: ImageImportBatchInput<string>) => promises.get(input.identity)!);
    const resultPromise = importImageBatch(
      [
        { identity: "first", source: "first.png" },
        { identity: "second", source: "second.png" },
        { identity: "third", source: "third.png" }
      ],
      importer
    );

    expect(importer).toHaveBeenCalledTimes(3);
    third.resolve(readyAsset("third"));
    first.resolve(readyAsset("first"));
    second.resolve(readyAsset("second"));

    await expect(resultPromise).resolves.toMatchObject({
      ready: [
        { identity: "first", source: "first.png", asset: { status: "ready", src: "assets/first.png" } },
        { identity: "second", source: "second.png", asset: { status: "ready", src: "assets/second.png" } },
        { identity: "third", source: "third.png", asset: { status: "ready", src: "assets/third.png" } }
      ],
      failures: []
    });
  });

  it("separates non-ready results and thrown errors from ready imports", async () => {
    const error = new Error("disk full");
    const result = await importImageBatch(
      [
        { identity: "ready", source: { path: "/tmp/ready.png" } },
        { identity: "unsupported", source: { path: "/tmp/broken.png" } },
        { identity: "throw", source: { path: "/tmp/throw.png" } }
      ],
      async ({ identity }) => {
        if (identity === "ready") return readyAsset(identity);
        if (identity === "unsupported") return { status: "unsupported", message: "无法导入" };
        throw error;
      }
    );

    expect(result.ready).toEqual([
      {
        identity: "ready",
        source: { path: "/tmp/ready.png" },
        asset: readyAsset("ready")
      }
    ]);
    expect(result.failures).toEqual([
      {
        identity: "unsupported",
        source: { path: "/tmp/broken.png" },
        failure: { kind: "result", result: { status: "unsupported", message: "无法导入" } }
      },
      {
        identity: "throw",
        source: { path: "/tmp/throw.png" },
        failure: { kind: "error", error }
      }
    ]);
  });

  it("reports every input when the whole batch fails", async () => {
    const result = await importImageBatch(
      [
        { identity: "cancelled", source: 1 },
        { identity: "needs-document", source: 2 },
        { identity: "error", source: 3 }
      ],
      async ({ identity }) => {
        if (identity === "cancelled") return { status: "cancelled" };
        if (identity === "needs-document") return { status: "needs-document" };
        throw new TypeError("unreadable");
      }
    );

    expect(result.ready).toEqual([]);
    expect(result.failures.map(({ identity }) => identity)).toEqual([
      "cancelled",
      "needs-document",
      "error"
    ]);
    expect(result.failures.map(({ failure }) => failure.kind)).toEqual([
      "result",
      "result",
      "error"
    ]);
  });

  it("does not call the importer for an empty batch", async () => {
    const importer = vi.fn<() => Promise<RuntimeImageAssetResult>>();

    await expect(importImageBatch([], importer)).resolves.toEqual({ ready: [], failures: [] });
    expect(importer).not.toHaveBeenCalled();
  });
});

function readyAsset(identity: string): RuntimeImageAssetResult {
  return {
    status: "ready",
    src: `assets/${identity}.png`,
    displaySrc: `mmm-asset://${identity}`
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}
