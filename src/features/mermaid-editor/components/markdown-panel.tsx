"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Crepe } from "@milkdown/crepe";
import { EditorStatus, editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { Check, CodeBrackets, List, NumberedListLeft, Quote, TaskList, Text, TextSize } from "iconoir-react/regular";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  convertMarkdownBlock,
  getMarkdownBlockStyle,
  type MarkdownBlockStyle
} from "@/features/mermaid-editor/lib/markdown-block-style";
import { cn } from "@/lib/utils";

type MarkdownPanelProps = {
  value: string;
  className?: string;
  readOnly?: boolean;
  spellCheck: boolean;
  contentWidth: number;
  onChange: (value: string) => void;
};

type BlockStyleMenuState = {
  conversionFailed: boolean;
  currentStyle: MarkdownBlockStyle | null;
  handleHeight: number;
  left: number;
  position: number;
  top: number;
};

const blockStyleGroups = [
  [
    { style: "paragraph", label: "正文", icon: Text },
    { style: "heading-1", label: "H1", icon: TextSize },
    { style: "heading-2", label: "H2", icon: TextSize },
    { style: "heading-3", label: "H3", icon: TextSize },
    { style: "heading-4", label: "H4", icon: TextSize },
    { style: "heading-5", label: "H5", icon: TextSize },
    { style: "heading-6", label: "H6", icon: TextSize }
  ],
  [
    { style: "bullet-list", label: "无序列表", icon: List },
    { style: "ordered-list", label: "有序列表", icon: NumberedListLeft },
    { style: "task-list", label: "任务项", icon: TaskList }
  ],
  [
    { style: "blockquote", label: "引用", icon: Quote },
    { style: "code-block", label: "代码块", icon: CodeBrackets }
  ]
] satisfies ReadonlyArray<ReadonlyArray<{ style: MarkdownBlockStyle; label: string; icon: typeof Text }>>;

export function MarkdownPanel({ value, className, readOnly = false, spellCheck, contentWidth, onChange }: MarkdownPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const blockDragCleanupTimerRef = useRef<number | null>(null);
  const blockDragOccurredRef = useRef(false);
  const initialValueRef = useRef(value);
  const initialReadOnlyRef = useRef(readOnly);
  const spellCheckRef = useRef(spellCheck);
  const onChangeRef = useRef(onChange);
  const [blockStyleMenu, setBlockStyleMenu] = useState<BlockStyleMenuState | null>(null);

  const changeBlockStyle = useCallback((style: MarkdownBlockStyle) => {
    const menu = blockStyleMenu;
    const crepe = crepeRef.current;
    if (!menu) return false;

    let converted = false;
    if (crepe?.editor.status === EditorStatus.Created) {
      try {
        crepe.editor.action((ctx) => {
          converted = convertMarkdownBlock(ctx.get(editorViewCtx), menu.position, style);
        });
      } catch {
        converted = false;
      }
    }

    if (converted) {
      setBlockStyleMenu(null);
      return true;
    }

    setBlockStyleMenu((current) => current?.position === menu.position
      ? { ...current, conversionFailed: true }
      : current);
    return false;
  }, [blockStyleMenu]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;

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
    void crepe.create().then(() => {
      if (!disposed && crepeRef.current === crepe) {
        applyMarkdownSpellcheck(crepe, spellCheckRef.current);
      }
    });

    return () => {
      disposed = true;
      crepeRef.current = null;
      void crepe.destroy();
    };
  }, []);

  useEffect(() => {
    crepeRef.current?.setReadonly(readOnly);
  }, [readOnly]);

  useEffect(() => {
    spellCheckRef.current = spellCheck;
    const crepe = crepeRef.current;
    if (crepe) applyMarkdownSpellcheck(crepe, spellCheck);
  }, [spellCheck]);

  useEffect(() => {
    const currentPanel = panelRef.current;
    if (!currentPanel) return;
    const panelElement: HTMLElement = currentPanel;

    function isBlockHandleEvent(event: DragEvent) {
      return event.target instanceof Element && Boolean(event.target.closest(".milkdown-block-handle"));
    }

    function getDragHandle(target: EventTarget | null) {
      if (!(target instanceof Element)) return null;
      const operationItem = target.closest(".milkdown-block-handle > .operation-item");
      const blockHandle = operationItem?.parentElement;
      if (!operationItem || !blockHandle || operationItem !== blockHandle.lastElementChild) return null;
      return blockHandle;
    }

    function decorateBlockHandles() {
      panelElement.querySelectorAll<HTMLElement>(".milkdown-block-handle > .operation-item:last-child").forEach((handle) => {
        const blockHandle = handle.parentElement;
        const isVisible = blockHandle?.dataset.show === "true";
        handle.setAttribute("role", "button");
        handle.setAttribute("aria-label", "块样式");
        if (isVisible) handle.removeAttribute("aria-hidden");
        else handle.setAttribute("aria-hidden", "true");
        handle.tabIndex = isVisible ? 0 : -1;
      });
    }

    function clearBlockSelection() {
      const crepe = crepeRef.current;

      if (crepe?.editor.status === EditorStatus.Created) {
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state } = view;
          if (state.selection instanceof TextSelection) return;

          const anchor = Math.max(0, Math.min(state.selection.from, state.doc.content.size));
          const selection = TextSelection.near(state.doc.resolve(anchor), 1);
          view.dispatch(state.tr.setSelection(selection));
        });
      }

      panelElement.querySelectorAll(".ProseMirror-selectednode").forEach((node) => {
        node.classList.remove("ProseMirror-selectednode");
      });
    }

    function finishBlockDrag() {
      if (blockDragCleanupTimerRef.current != null) {
        window.clearTimeout(blockDragCleanupTimerRef.current);
      }

      panelElement.removeAttribute("data-md-block-dragging");
      blockDragCleanupTimerRef.current = window.setTimeout(() => {
        blockDragCleanupTimerRef.current = null;
        clearBlockSelection();
      }, 0);
    }

    function handleDragStart(event: DragEvent) {
      if (!isBlockHandleEvent(event)) return;

      blockDragOccurredRef.current = true;
      setBlockStyleMenu(null);
      panelElement.setAttribute("data-md-block-dragging", "true");
    }

    function handleDragOver(event: DragEvent) {
      if (panelElement.getAttribute("data-md-block-dragging") !== "true") return;
      if (!isBlockHandleEvent(event)) return;

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    }

    function handleDragEnd(event: DragEvent) {
      if (!isBlockHandleEvent(event) && panelElement.getAttribute("data-md-block-dragging") !== "true") return;
      finishBlockDrag();
    }

    function handleDrop() {
      if (panelElement.getAttribute("data-md-block-dragging") !== "true") return;
      finishBlockDrag();
    }

    function handlePointerDown(event: PointerEvent) {
      if (!getDragHandle(event.target)) return;
      blockDragOccurredRef.current = false;
    }

    function handleClick(event: MouseEvent) {
      const blockHandle = getDragHandle(event.target);
      if (!blockHandle || blockDragOccurredRef.current) return;

      const crepe = crepeRef.current;
      if (!crepe || crepe.editor.status !== EditorStatus.Created) return;

      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const rect = blockHandle.getBoundingClientRect();
        const editorRect = view.dom.getBoundingClientRect();
        const resolvedPosition = view.posAtCoords({
          left: editorRect.left + editorRect.width / 2,
          top: rect.top + rect.height / 2
        });
        const position = resolvedPosition && resolvedPosition.inside >= 0
          ? resolvedPosition.inside
          : resolvedPosition?.pos ?? view.state.selection.from;
        setBlockStyleMenu({
          conversionFailed: false,
          currentStyle: getMarkdownBlockStyle(view.state, position),
          handleHeight: rect.height,
          left: rect.right,
          position,
          top: rect.top
        });
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
      const blockHandle = getDragHandle(event.target);
      if (blockHandle?.dataset.show !== "true" || (event.key !== "Enter" && event.key !== " ")) return;

      event.preventDefault();
      blockDragOccurredRef.current = false;
      (event.target as HTMLElement).click();
    }

    function handleScroll() {
      setBlockStyleMenu(null);
    }

    const blockHandleObserver = new MutationObserver(decorateBlockHandles);
    blockHandleObserver.observe(panelElement, {
      attributeFilter: ["data-show"],
      attributes: true,
      childList: true,
      subtree: true
    });
    decorateBlockHandles();

    panelElement.addEventListener("pointerdown", handlePointerDown, true);
    panelElement.addEventListener("click", handleClick, true);
    panelElement.addEventListener("keydown", handleKeyDown, true);
    panelElement.addEventListener("dragstart", handleDragStart, true);
    panelElement.addEventListener("dragover", handleDragOver, true);
    panelElement.addEventListener("dragend", handleDragEnd, true);
    panelElement.addEventListener("drop", handleDrop, true);
    panelElement.addEventListener("scroll", handleScroll, true);

    return () => {
      panelElement.removeEventListener("pointerdown", handlePointerDown, true);
      panelElement.removeEventListener("click", handleClick, true);
      panelElement.removeEventListener("keydown", handleKeyDown, true);
      panelElement.removeEventListener("dragstart", handleDragStart, true);
      panelElement.removeEventListener("dragover", handleDragOver, true);
      panelElement.removeEventListener("dragend", handleDragEnd, true);
      panelElement.removeEventListener("drop", handleDrop, true);
      panelElement.removeEventListener("scroll", handleScroll, true);
      blockHandleObserver.disconnect();
      if (blockDragCleanupTimerRef.current != null) {
        window.clearTimeout(blockDragCleanupTimerRef.current);
        blockDragCleanupTimerRef.current = null;
      }
    };
  }, []);

  return (
    <section
      ref={panelRef}
      data-floating-panel-drag-exclude
      data-window-drag-exclude
      className={cn("markdown-editor-panel relative z-0 h-full min-h-0 overflow-auto bg-background", className)}
      style={{ "--markdown-content-width": `${contentWidth}px` } as CSSProperties}
    >
      <div ref={rootRef} className="min-h-full" />
      {blockStyleMenu ? (
        <DropdownMenu open onOpenChange={(open) => { if (!open) setBlockStyleMenu(null); }}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="pointer-events-none fixed w-px select-none opacity-0"
              style={{
                height: Math.max(1, blockStyleMenu.handleHeight),
                left: blockStyleMenu.left,
                top: blockStyleMenu.top
              }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={6}
            className="grid w-56 grid-cols-2 gap-0.5 p-1 select-none"
            aria-label="块样式"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx).focus());
            }}
          >
            {blockStyleGroups.map((group, groupIndex) => (
              <DropdownMenuGroup key={groupIndex} className="contents">
                {groupIndex > 0 ? <DropdownMenuSeparator className="col-span-2" /> : null}
                {group.map((option) => {
                  const Icon = option.icon;
                  const isCurrent = option.style === blockStyleMenu.currentStyle;
                  return (
                    <DropdownMenuItem
                      key={option.style}
                      className="min-w-0"
                      aria-current={isCurrent ? "true" : undefined}
                      onSelect={(event) => {
                        if (!changeBlockStyle(option.style)) event.preventDefault();
                      }}
                    >
                      <Icon className="size-4" />
                      <span className="truncate">{option.label}</span>
                      {isCurrent ? <Check className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            ))}
            {blockStyleMenu.conversionFailed ? (
              <div role="alert" className="col-span-2 px-2 py-1.5 text-xs text-destructive">
                未能应用，请重试
              </div>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </section>
  );
}

function applyMarkdownSpellcheck(crepe: Crepe, enabled: boolean) {
  if (crepe.editor.status !== EditorStatus.Created) return;
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.dom.setAttribute("spellcheck", enabled ? "true" : "false");
  });
}
