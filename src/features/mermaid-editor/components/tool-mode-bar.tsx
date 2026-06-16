"use client";

import { CursorPointer as MousePointer2, PathArrow } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EditorMode } from "@/features/mermaid-editor/lib/editor-types";
import { cn } from "@/lib/utils";

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
    <div className="flex items-center gap-1">
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
                className={cn("size-8", active ? "text-background hover:text-background" : "text-icon hover:text-icon")}
                onClick={() => onModeChange(tool.mode)}
                aria-label={`${tool.label}模式`}
              >
                <Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {tool.label} ({tool.shortcut})
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
