"use client";

import { CursorPointer as MousePointer2, PathArrow } from "iconoir-react/regular";

import { EditorIconButton, EditorToolbarGroup } from "@/features/mermaid-editor/components/editor-ui";
import type { EditorMode } from "@/features/mermaid-editor/lib/editor-types";

type ToolModeBarProps = {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
};

const tools = [
  { mode: "select" as const, label: "选择", shortcut: "V", icon: MousePointer2 },
  { mode: "connect" as const, label: "连线", shortcut: "L", icon: PathArrow }
];

export function ToolModeBar({ mode, onModeChange }: ToolModeBarProps) {
  return (
    <EditorToolbarGroup>
      {tools.map((tool) => {
        const Icon = tool.icon;
        const active = mode === tool.mode;

        return (
          <EditorIconButton
                key={tool.mode}
                type="button"
                context="toolbar"
                label={`${tool.label}模式`}
                tooltipSide="bottom"
                pressed={active}
                onClick={() => onModeChange(tool.mode)}
              >
                <Icon />
          </EditorIconButton>
        );
      })}
    </EditorToolbarGroup>
  );
}
