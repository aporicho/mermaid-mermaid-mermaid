import { useEffect, useState } from "react";
import {
  Code,
  Collapse,
  Expand,
  GitBranch as Workflow,
  Minus,
  SquareCursor as SquareDashedMousePointer,
  Text,
  Xmark
} from "iconoir-react/regular";

import { FloatingButtonCluster, FloatingIconButton } from "@/features/mermaid-editor/components/floating-chrome";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditableKind } from "@/features/mermaid-editor/lib/editor-types";
import { workspaceViewsForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";

const workspaceViewLabels: Record<WorkspaceView, string> = {
  canvas: "画布",
  render: "预览",
  source: "源码",
  markdown: "Markdown"
};

export function WorkspaceViewCluster({
  workspaceView,
  editableKind,
  documentKind,
  canvasViewTooltip,
  onChange
}: {
  workspaceView: WorkspaceView;
  editableKind: EditableKind;
  documentKind: DocumentKind;
  canvasViewTooltip: string;
  onChange: (view: WorkspaceView) => void;
}) {
  const views = workspaceViewsForDocument(editableKind, documentKind);

  return (
    <FloatingButtonCluster orientation="vertical">
      {views.map((view) => {
        const label = view === "canvas" ? canvasViewTooltip : workspaceViewLabels[view];
        const Icon = view === "canvas" ? SquareDashedMousePointer : view === "render" ? Workflow : view === "markdown" ? Text : Code;
        return (
          <FloatingIconButton
            key={view}
            label={label}
            tooltipSide="left"
            active={workspaceView === view}
            aria-pressed={workspaceView === view}
            onClick={() => onChange(view)}
          >
            <Icon />
          </FloatingIconButton>
        );
      })}
    </FloatingButtonCluster>
  );
}

export function DesktopWindowControls({ runtime }: { runtime: EditorRuntime }) {
  const [available, setAvailable] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setAvailable(runtime.isDesktopWindowAvailable());
    let disposed = false;
    let stopListening: (() => void) | undefined;
    void runtime.getDesktopWindowFullscreen().then((value) => {
      if (!disposed) setFullscreen(value);
    }).catch(() => undefined);
    void runtime.listenForDesktopWindowFullscreenChange((value) => {
      if (!disposed) setFullscreen(value);
    }).then((cleanup) => {
      if (disposed) cleanup();
      else stopListening = cleanup;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, [runtime]);

  async function runWindowAction(action: "minimize" | "toggleMaximize" | "close") {
    try {
      await runtime.runDesktopWindowAction(action);
    } catch {
      // Window controls are desktop-only; ignore capability/runtime failures in web-like shells.
    }
  }

  async function toggleFullscreen() {
    try {
      setFullscreen(await runtime.toggleDesktopWindowFullscreen());
    } catch {
      // Window controls are desktop-only; ignore capability/runtime failures in web-like shells.
    }
  }

  if (!available) return null;

  return (
    <div className="flex items-center gap-2" data-window-drag-exclude>
      <FloatingIconButton type="button" label="最小化" tooltipSide="bottom" onClick={() => void runWindowAction("minimize")}>
        <Minus />
      </FloatingIconButton>
      <FloatingIconButton type="button" label={fullscreen ? "退出系统全屏" : "进入系统全屏"} tooltipSide="bottom" onClick={() => void toggleFullscreen()}>
        {fullscreen ? <Collapse /> : <Expand />}
      </FloatingIconButton>
      <FloatingIconButton type="button" label="关闭" tooltipSide="bottom" danger onClick={() => void runWindowAction("close")}>
        <Xmark />
      </FloatingIconButton>
    </div>
  );
}
