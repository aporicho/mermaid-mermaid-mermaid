// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentMergeDialog } from "@/features/mermaid-editor/components/document-merge-dialog";
import type { RuntimeDocumentSnapshot } from "@/features/mermaid-editor/lib/editor-runtime";

describe("DocumentMergeDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("labels a node-position conflict and defaults to the local coordinates", async () => {
    const onResolve = vi.fn(async () => undefined);
    const token = '"\uE000MMM_LAYOUT_CONFLICT_0\uE001"';
    const snapshot = conflictSnapshot(token);

    await act(async () => {
      root.render(<DocumentMergeDialog snapshot={snapshot} onResolve={onResolve} />);
    });

    expect(document.body.textContent).toContain("节点 A 的位置");
    expect(document.body.textContent).toContain("基线 (10, 20) · 本地 (30, 24) · 磁盘 (44, 36)");

    await act(async () => clickButton("应用合并并保存"));

    expect(onResolve).toHaveBeenCalledWith(expect.stringContaining('"A":{"x":30,"y":24,"fill":"#fff"}'), "disk-revision");
  });

  it("can choose the disk coordinates for one node", async () => {
    const onResolve = vi.fn(async () => undefined);
    const token = '"\uE000MMM_LAYOUT_CONFLICT_0\uE001"';

    await act(async () => {
      root.render(<DocumentMergeDialog snapshot={conflictSnapshot(token)} onResolve={onResolve} />);
    });
    await act(async () => clickButton("采用磁盘"));
    await act(async () => clickButton("应用合并并保存"));

    expect(onResolve).toHaveBeenCalledWith(expect.stringContaining('"A":{"x":44,"y":36,"fill":"#fff"}'), "disk-revision");
  });
});

function conflictSnapshot(token: string): RuntimeDocumentSnapshot {
  const prefix = "%% canvas-layout: ";
  const baseLayout = '{"version":1,"layoutMode":"manual","viewport":{"x":220,"y":90,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"}}}';
  const localNode = '{"x":30,"y":24,"fill":"#fff"}';
  const diskNode = '{"x":44,"y":36,"fill":"#fff"}';
  return {
    documentId: "document-1",
    file: { name: "diagram.mmd", path: "/project/diagram.mmd" },
    kind: "mermaid",
    content: `${prefix}${baseLayout}\nflowchart LR\n  A[Alpha]\n`,
    savedContent: `${prefix}${baseLayout}\nflowchart LR\n  A[Alpha]\n`,
    workingVersion: 2,
    workingRevision: "working-revision",
    baseRevision: "base-revision",
    diskRevision: "disk-revision",
    modifiedAt: 1,
    exists: true,
    syncState: "conflict",
    saveState: "idle",
    dirty: true,
    leaseOwnerId: null,
    canUndo: true,
    canRedo: false,
    error: null,
    conflict: {
      baseContent: `${prefix}${baseLayout}\nflowchart LR\n  A[Alpha]\n`,
      localContent: `${prefix}${baseLayout}\nflowchart LR\n  A[Alpha]\n`,
      diskContent: `${prefix}${baseLayout}\nflowchart LR\n  A[Alpha]\n`,
      diskRevision: "disk-revision",
      conflicts: [{
        start: 0,
        end: 1,
        base: '{"x":10,"y":20,"fill":"#fff"}',
        local: localNode,
        disk: diskNode,
        token,
        kind: "canvas-node-position",
        label: "节点 A 的位置"
      }],
      resolutionTemplate: `${prefix}{"version":1,"layoutMode":"manual","viewport":{"x":220,"y":90,"scale":1},"nodes":{"A":${token}}}\nflowchart LR\n  A[Alpha]\n`
    }
  };
}

function clickButton(label: string) {
  const button = [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === label);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  button.click();
}
