// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DesktopWindowControls } from "@/features/mermaid-editor/components/workspace-view-controls";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";

describe("DesktopWindowControls", () => {
  const containers: HTMLDivElement[] = [];

  afterEach(() => {
    for (const container of containers.splice(0)) container.remove();
  });

  it("uses native fullscreen and changes the action to exit fullscreen", async () => {
    const container = document.createElement("div");
    containers.push(container);
    document.body.appendChild(container);
    const root = createRoot(container);
    const toggleDesktopWindowFullscreen = vi.fn(async () => true);
    const runtime = {
      isDesktopWindowAvailable: () => true,
      getDesktopWindowFullscreen: vi.fn(async () => false),
      toggleDesktopWindowFullscreen,
      listenForDesktopWindowFullscreenChange: vi.fn(async () => () => undefined),
      runDesktopWindowAction: vi.fn(async () => undefined)
    } as unknown as EditorRuntime;

    await act(async () => {
      root.render(<TooltipProvider delayDuration={0}><DesktopWindowControls runtime={runtime} /></TooltipProvider>);
      await Promise.resolve();
    });
    const enterButton = container.querySelector<HTMLButtonElement>("button[aria-label='进入系统全屏']");
    expect(enterButton).not.toBeNull();

    await act(async () => {
      enterButton?.click();
      await Promise.resolve();
    });
    expect(toggleDesktopWindowFullscreen).toHaveBeenCalledTimes(1);
    expect(container.querySelector("button[aria-label='退出系统全屏']")).not.toBeNull();

    act(() => root.unmount());
  });
});
