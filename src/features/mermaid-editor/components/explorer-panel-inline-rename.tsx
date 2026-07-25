import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import type { ProjectResourceEntry } from "@/features/mermaid-editor/lib/project-workspace";
import { cn } from "@/lib/utils";

export function ExplorerInlineRename({
  resource,
  projectBusy,
  onCancel,
  onCommit
}: {
  resource: ProjectResourceEntry;
  projectBusy: boolean;
  onCancel: () => void;
  onCommit: (name: string) => void;
}) {
  const [name, setName] = useState(resource.name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function finish(mode: "commit" | "cancel") {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (mode === "cancel" || projectBusy) {
      onCancel();
      return;
    }
    const normalized = name.trim();
    if (!normalized || normalized === resource.name) {
      onCancel();
      return;
    }
    onCommit(normalized);
  }

  return (
    <Input
      ref={inputRef}
      value={name}
      aria-label={`重命名 ${resource.name}`}
      disabled={projectBusy}
      className={cn(
        "h-[calc(var(--ui-tree-row-height)-2px)] min-w-0 flex-1 rounded-sm border px-1.5 py-0 text-xs shadow-none",
        "focus-visible:ring-1 focus-visible:ring-ring"
      )}
      data-project-resource-rename-input
      onChange={(event) => setName(event.target.value)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          finish("commit");
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish("cancel");
        }
      }}
      onBlur={() => finish("commit")}
    />
  );
}
