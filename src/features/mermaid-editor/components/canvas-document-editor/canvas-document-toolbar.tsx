import type { ReactNode } from "react";
import { CreditCard, FrameSimple, Link, Maximize, Plus, Text as TextIcon, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CanvasShapeKind } from "@/features/mermaid-editor/lib/canvas-document";
import { cn } from "@/lib/utils";

const SHAPE_OPTIONS: { shape: CanvasShapeKind; label: string }[] = [
  { shape: "rect", label: "矩形" },
  { shape: "roundRect", label: "圆角" },
  { shape: "ellipse", label: "椭圆" },
  { shape: "diamond", label: "菱形" }
];

type CanvasDocumentToolbarProps = {
  connectorActive: boolean;
  selectedCount: number;
  onAddShape: (shape: CanvasShapeKind) => void;
  onAddCard: () => void;
  onAddText: () => void;
  onAddConnector: () => void;
  onAddImage: () => void;
  onDeleteSelection: () => void;
  onResetViewport: () => void;
};

export function CanvasDocumentToolbar({
  connectorActive,
  selectedCount,
  onAddShape,
  onAddCard,
  onAddText,
  onAddConnector,
  onAddImage,
  onDeleteSelection,
  onResetViewport
}: CanvasDocumentToolbarProps) {
  return (
    <div className="absolute left-[76px] top-4 z-20 flex items-center gap-1 rounded-md border bg-card/95 p-1 shadow-sm backdrop-blur">
      {SHAPE_OPTIONS.map((option) => (
        <ToolbarButton key={option.shape} label={`添加${option.label}`} onClick={() => onAddShape(option.shape)}>
          <Plus className="size-4" />
        </ToolbarButton>
      ))}
      <ToolbarButton label="添加卡片" onClick={onAddCard}>
        <CreditCard className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="添加文本" onClick={onAddText}>
        <TextIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton label={connectorActive ? "点击第二个对象完成连线" : "添加连线"} active={connectorActive} onClick={onAddConnector}>
        <Link className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="添加图片" onClick={onAddImage}>
        <FrameSimple className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="删除选中内容" disabled={!selectedCount} onClick={onDeleteSelection}>
        <Xmark className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="重置视图" onClick={onResetViewport}>
        <Maximize className="size-4" />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={active ? "default" : "ghost"}
          className={cn("size-8", active ? "text-background hover:text-background" : "text-icon hover:text-icon")}
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
