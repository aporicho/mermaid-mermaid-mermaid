// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectResourceOpener } from "@/features/mermaid-editor/components/mermaid-editor/use-project-resource-opener";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import type { ProjectResourceOpenRequest } from "@/features/mermaid-editor/lib/project-resource-open";

type Opener = ReturnType<typeof useProjectResourceOpener>;
type Openers = Parameters<typeof useProjectResourceOpener>[0];

describe("useProjectResourceOpener", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 2400 },
      innerHeight: { configurable: true, value: 1800 }
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("dispatches current and floating requests through the same entry point", () => {
    const openers = createOpeners();
    const openResource = renderOpener(openers);
    const file = projectFile("notes/readme.md");

    expect(openResource(request(file, "current"))).toBe(true);
    expect(openResource(request(file, "floating"))).toBe(true);

    expect(openers.openCurrentFile).toHaveBeenCalledOnce();
    expect(openers.openCurrentFile).toHaveBeenCalledWith(file, undefined);
    expect(openers.openMarkdownWindow).toHaveBeenCalledOnce();
    expect(openers.openMarkdownWindow).toHaveBeenCalledWith(file, expect.objectContaining({ activationKey: 2 }));
    expect(openers.onStatus).toHaveBeenNthCalledWith(1, "正在打开 readme.md…");
    expect(openers.onStatus).toHaveBeenNthCalledWith(2, "正在打开 readme.md…");
  });

  it.each([
    ["markdown", "notes/readme.md", "openMarkdownWindow"],
    ["html", "site/index.html", "openHtmlWindow"],
    ["image", "assets/cover.png", "openImageWindow"],
    ["text", "notes/todo.txt", "openTextWindow"],
    ["csv", "data/table.csv", "openCsvWindow"]
  ] as const)("dispatches a %s floating resource to its type-specific opener", (_kind, path, openerName) => {
    const openers = createOpeners();
    const openResource = renderOpener(openers);
    const file = projectFile(path);

    expect(openResource(request(file, "floating"))).toBe(true);

    expect(openers[openerName]).toHaveBeenCalledOnce();
    expect(openers[openerName]).toHaveBeenCalledWith(file, expect.objectContaining({ activationKey: 1 }));
    const floatingCalls = [
      openers.openMarkdownWindow,
      openers.openHtmlWindow,
      openers.openImageWindow,
      openers.openTextWindow,
      openers.openCsvWindow
    ].reduce((total, opener) => total + vi.mocked(opener).mock.calls.length, 0);
    expect(floatingCalls).toBe(1);
    expect(openers.openCurrentFile).not.toHaveBeenCalled();
  });

  it("suppresses duplicate in-flight requests and permits reopening after completion", async () => {
    const deferred = deferredPromise<void>();
    const openers = createOpeners({ openMarkdownWindow: vi.fn(() => deferred.promise) });
    const openResource = renderOpener(openers);
    const openRequest = request(projectFile("notes/readme.md"), "floating");

    expect(openResource(openRequest)).toBe(true);
    expect(openResource(openRequest)).toBe(true);
    expect(openers.openMarkdownWindow).toHaveBeenCalledOnce();
    expect(openers.onStatus).toHaveBeenCalledOnce();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
      await Promise.resolve();
    });

    expect(openResource(openRequest)).toBe(true);
    expect(openers.openMarkdownWindow).toHaveBeenCalledTimes(2);
    expect(openers.onStatus).toHaveBeenCalledTimes(2);
  });

  it("generates a cascaded window request with unique activation metadata", () => {
    const openers = createOpeners();
    const openResource = renderOpener(openers);
    const file = projectFile("notes/readme.md");
    const placementAnchor = {
      sourcePanelId: "markdown:source.md",
      sourcePanelRect: { left: 100, top: 100, right: 500, bottom: 500 },
      sourceTitlebarHeight: 40
    };

    expect(openResource({ ...request(file, "floating"), placementAnchor })).toBe(true);

    expect(openers.openMarkdownWindow).toHaveBeenCalledWith(file, {
      activationKey: 1,
      initialFrameKey: "floating:/project/notes/readme.md:1",
      initialFrame: {
        x: 152,
        y: 140,
        width: 1050,
        height: 1485
      }
    });
  });

  it("returns false without side effects for unsupported resource types", () => {
    const openers = createOpeners();
    const openResource = renderOpener(openers);

    expect(openResource(request(projectFile("assets/archive.pdf"), "floating"))).toBe(false);
    expect(openResource(request(projectFile("assets/archive.pdf"), "current"))).toBe(false);

    expect(openers.openCurrentFile).not.toHaveBeenCalled();
    expect(openers.openMarkdownWindow).not.toHaveBeenCalled();
    expect(openers.openHtmlWindow).not.toHaveBeenCalled();
    expect(openers.openImageWindow).not.toHaveBeenCalled();
    expect(openers.openTextWindow).not.toHaveBeenCalled();
    expect(openers.openCsvWindow).not.toHaveBeenCalled();
    expect(openers.onStatus).not.toHaveBeenCalled();
    expect(openers.onError).not.toHaveBeenCalled();
  });

  function renderOpener(openers: Openers) {
    const openerRef: { current: Opener | null } = { current: null };
    act(() => {
      root.render(<Harness openers={openers} onOpener={(opener) => { openerRef.current = opener; }} />);
    });
    if (!openerRef.current) throw new Error("Expected project resource opener to mount.");
    return openerRef.current;
  }
});

function Harness({ openers, onOpener }: { openers: Openers; onOpener: (opener: Opener) => void }) {
  onOpener(useProjectResourceOpener(openers));
  return null;
}

function createOpeners(overrides: Partial<Openers> = {}): Openers {
  return {
    openCurrentFile: vi.fn(),
    openMarkdownWindow: vi.fn(),
    openHtmlWindow: vi.fn(),
    openImageWindow: vi.fn(),
    openTextWindow: vi.fn(),
    openCsvWindow: vi.fn(),
    onStatus: vi.fn(),
    onError: vi.fn(),
    ...overrides
  };
}

function projectFile(relativePath: string): ProjectFileEntry {
  return {
    name: relativePath.split("/").at(-1) || relativePath,
    path: `/project/${relativePath}`,
    relativePath
  };
}

function request(file: ProjectFileEntry, mode: ProjectResourceOpenRequest["mode"]): ProjectResourceOpenRequest {
  return { file, mode, source: "markdown-link" };
}

function deferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
