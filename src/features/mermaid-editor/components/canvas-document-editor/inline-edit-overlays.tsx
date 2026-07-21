import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  CanvasDocumentInlineEdit,
  CanvasDocumentInlineEditStyle
} from "@/features/mermaid-editor/components/canvas-document-editor/types";

type CanvasDocumentInlineEditOverlaysProps = {
  inlineEdit: CanvasDocumentInlineEdit | null;
  editStyle: CanvasDocumentInlineEditStyle | null;
  onChange: (value: string) => void;
  onCommit: (save: boolean) => void;
};

export function CanvasDocumentInlineEditOverlays({
  inlineEdit,
  editStyle,
  onChange,
  onCommit
}: CanvasDocumentInlineEditOverlaysProps) {
  const itemEditorRef = useRef<HTMLTextAreaElement>(null);
  const itemEditorMeasureRef = useRef<HTMLDivElement>(null);
  const connectionEditorRef = useRef<HTMLInputElement>(null);
  const [itemEditorLayout, setItemEditorLayout] = useState({ insetTop: 0, height: 1, scrollable: false });

  useEffect(() => {
    if (inlineEdit?.type === "item") {
      const editor = itemEditorRef.current;
      if (!editor) return;
      editor.focus();
      editor.select();
      return;
    }

    if (inlineEdit?.type === "connection") {
      const editor = connectionEditorRef.current;
      if (!editor) return;
      editor.focus();
      editor.select();
    }
  }, [inlineEdit?.id, inlineEdit?.type]);

  useLayoutEffect(() => {
    if (inlineEdit?.type !== "item" || !editStyle) return;
    const measure = itemEditorMeasureRef.current;
    if (!measure) return;

    const minimumHeight = editStyle.lineHeight;
    const measuredHeight = Math.max(minimumHeight, Math.ceil(measure.scrollHeight));
    const scrollable = measuredHeight > editStyle.height + 1;
    const height = scrollable ? editStyle.height : Math.min(editStyle.height, measuredHeight);
    const insetTop = editStyle.verticalAlign === "middle" ? Math.max(0, Math.floor((editStyle.height - height) / 2)) : 0;

    setItemEditorLayout((current) => {
      if (current.height === height && current.insetTop === insetTop && current.scrollable === scrollable) return current;
      return { height, insetTop, scrollable };
    });
  }, [editStyle, inlineEdit?.type, inlineEdit?.value]);

  if (!inlineEdit || !editStyle) return null;

  if (inlineEdit.type === "item") {
    return (
      <>
        <div
          ref={itemEditorMeasureRef}
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] top-0 whitespace-pre-wrap"
          style={{
            width: editStyle.width,
            fontFamily: editStyle.fontFamily,
            fontSize: editStyle.fontSize,
            fontWeight: editStyle.fontWeight,
            letterSpacing: editStyle.letterSpacing,
            lineHeight: `${editStyle.lineHeight}px`,
            textAlign: editStyle.textAlign,
            overflowWrap: "break-word",
            wordBreak: "break-word",
            visibility: "hidden"
          }}
        >
          {inlineEdit.value || "\u200b"}
        </div>
        <Textarea
          ref={itemEditorRef}
          aria-label="编辑画布文字"
          value={inlineEdit.value}
          className="absolute z-40 block min-h-0 resize-none overflow-x-hidden rounded-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            left: editStyle.left,
            top: editStyle.top + itemEditorLayout.insetTop,
            width: editStyle.width,
            height: itemEditorLayout.height,
            color: editStyle.color,
            fontFamily: editStyle.fontFamily,
            fontSize: editStyle.fontSize,
            fontWeight: editStyle.fontWeight,
            letterSpacing: editStyle.letterSpacing,
            lineHeight: `${editStyle.lineHeight}px`,
            textAlign: editStyle.textAlign,
            overflowWrap: "break-word",
            wordBreak: "break-word",
            overflowY: itemEditorLayout.scrollable ? "auto" : "hidden"
          }}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onCommit(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onCommit(true);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCommit(false);
            }
          }}
        />
      </>
    );
  }

  return (
    <Input
      ref={connectionEditorRef}
      aria-label="编辑连线文字"
      value={inlineEdit.value}
      className="absolute z-40 h-auto min-h-0 rounded-none border bg-card p-0 text-center font-normal shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      style={{
        left: editStyle.left,
        top: editStyle.top,
        width: editStyle.width,
        height: editStyle.height,
        borderRadius: editStyle.borderRadius,
        color: editStyle.color,
        fontFamily: editStyle.fontFamily,
        fontSize: editStyle.fontSize,
        fontWeight: editStyle.fontWeight,
        letterSpacing: editStyle.letterSpacing,
        lineHeight: `${editStyle.lineHeight}px`,
        paddingLeft: editStyle.paddingX,
        paddingRight: editStyle.paddingX,
        textAlign: editStyle.textAlign
      }}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => onCommit(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit(true);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCommit(false);
        }
      }}
    />
  );
}
