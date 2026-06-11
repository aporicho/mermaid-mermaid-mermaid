"use client";

import { CursorPointer as MousePointer2, DragHandGesture as Hand, Link as Link2, Redo as Redo2, Undo as Undo2 } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EditorMode } from "@/features/mermaid-editor/lib/editor-types";
import { cn } from "@/lib/utils";

type ToolModeBarProps = {
  mode: EditorMode;
  scale: number;
  selectedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onModeChange: (mode: EditorMode) => void;
  onUndo: () => void;
  onRedo: () => void;
};

const tools = [
  { mode: "select" as const, label: "选择", shortcut: "V", icon: MousePointer2 },
  { mode: "connect" as const, label: "连线", shortcut: "L", icon: Link2 },
  { mode: "pan" as const, label: "平移", shortcut: "H", icon: Hand }
];

export function ToolModeBar({ mode, scale, selectedCount, canUndo, canRedo, onModeChange, onUndo, onRedo }: ToolModeBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 shadow-sm">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const active = mode === tool.mode;

        return (
          <Tooltip key={tool.mode}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant={active ? "default" : "ghost"}
                className={cn("size-8", active && "text-primary-foreground")}
                onClick={() => onModeChange(tool.mode)}
                aria-label={`${tool.label}模式`}
              >
                <Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {tool.label} ({tool.shortcut})
            </TooltipContent>
          </Tooltip>
        );
      })}

      <div className="mx-1 h-6 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={onUndo} disabled={!canUndo} aria-label="撤销">
            <Undo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>撤销</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={onRedo} disabled={!canRedo} aria-label="重做">
            <Redo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>重做</TooltipContent>
      </Tooltip>

      <div className="mx-1 h-6 w-px bg-border" />

      <span className="min-w-12 text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
      <span className="text-xs text-muted-foreground">{selectedCount ? `已选 ${selectedCount}` : "未选择"}</span>
    </div>
  );
}
