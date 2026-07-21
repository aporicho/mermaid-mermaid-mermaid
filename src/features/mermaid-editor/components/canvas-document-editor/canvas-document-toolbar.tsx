import type { ReactNode } from "react";
import { CreditCard, FrameSimple, Link, Maximize, Plus, Text as TextIcon, Xmark } from "iconoir-react/regular";

import { EditorIconButton, EditorToolbar } from "@/features/mermaid-editor/components/editor-ui";
import type { CanvasShapeKind } from "@/features/mermaid-editor/lib/canvas-document";

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
    <EditorToolbar className="absolute left-[76px] top-4 z-20">
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
    </EditorToolbar>
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
    <EditorIconButton
      type="button"
      context="toolbar"
      label={label}
      pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </EditorIconButton>
  );
}
