"use client";

import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

import { cn } from "@/lib/utils";

type MarkdownPanelProps = {
  value: string;
  className?: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
};

export function MarkdownPanel({ value, className, readOnly = false, onChange }: MarkdownPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const initialValueRef = useRef(value);
  const initialReadOnlyRef = useRef(readOnly);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const crepe = new Crepe({
      root,
      defaultValue: initialValueRef.current
    });
    crepe.setReadonly(initialReadOnlyRef.current);
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current(markdown);
      });
    });
    crepeRef.current = crepe;
    void crepe.create();

    return () => {
      crepeRef.current = null;
      void crepe.destroy();
    };
  }, []);

  useEffect(() => {
    crepeRef.current?.setReadonly(readOnly);
  }, [readOnly]);

  return (
    <section className={cn("markdown-editor-panel relative z-0 h-full min-h-0 overflow-auto bg-background", className)}>
      <div ref={rootRef} className="min-h-full" />
    </section>
  );
}
