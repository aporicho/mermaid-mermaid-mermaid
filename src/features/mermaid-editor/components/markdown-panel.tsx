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
import {
  findMarkdownFoldTarget,
  markdownFolding,
  toggleMarkdownFold,
  type MarkdownFoldKind,
  type MarkdownFoldTarget
} from "@/features/mermaid-editor/lib/markdown-folding";
import { clampMarkdownTextScale } from "@/features/mermaid-editor/lib/markdown-text-scale";
import { cn } from "@/lib/utils";

type MarkdownPanelProps = {
  value: string;
  className?: string;
  readOnly?: boolean;
  spellCheck: boolean;
  contentWidth: number;
  textScale: number;
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

export function MarkdownPanel({ value, className, readOnly = false, spellCheck, contentWidth, textScale, onChange }: MarkdownPanelProps) {
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
    crepe.editor.use(markdownFolding);
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
      return event.target instanceof Element
        && !event.target.closest(".markdown-fold-handle-button")
        && Boolean(event.target.closest(".milkdown-block-handle"));
    }

    function getDragHandle(target: EventTarget | null) {
      if (!(target instanceof Element)) return null;
      const operationItem = target.closest(".milkdown-block-handle > .operation-item:not(.markdown-fold-handle-button)");
      const blockHandle = operationItem?.parentElement;
      if (!operationItem || !blockHandle) return null;
      const operationItems = Array.from(
        blockHandle.querySelectorAll(":scope > .operation-item:not(.markdown-fold-handle-button)")
      );
      if (operationItem !== operationItems[operationItems.length - 1]) return null;
      return blockHandle;
    }

    function resolveBlockHandlePosition(blockHandle: HTMLElement) {
      const crepe = crepeRef.current;
      if (!crepe || crepe.editor.status !== EditorStatus.Created) return null;

      return crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const rect = blockHandle.getBoundingClientRect();
        const editorRect = view.dom.getBoundingClientRect();
        const resolved = view.posAtCoords({
          left: editorRect.left + editorRect.width / 2,
          top: rect.top + rect.height / 2
        });
        return {
          position: resolved && resolved.inside >= 0
            ? resolved.inside
            : resolved?.pos ?? view.state.selection.from,
          view
        };
      });
    }

    function setFoldButtonVisible(blockHandle: HTMLElement, button: HTMLButtonElement, visible: boolean) {
      if (button.hidden === !visible) return;
      const beforeWidth = blockHandle.getBoundingClientRect().width;
      button.hidden = !visible;
      const afterWidth = blockHandle.getBoundingClientRect().width;
      const currentLeft = Number.parseFloat(blockHandle.style.left);
      if (Number.isFinite(currentLeft) && beforeWidth !== afterWidth) {
        blockHandle.style.left = `${currentLeft - (afterWidth - beforeWidth)}px`;
      }
    }

    function hideFoldButton(blockHandle: HTMLElement, button: HTMLButtonElement) {
      setFoldButtonVisible(blockHandle, button, false);
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;
      delete button.dataset.markdownFoldKind;
      delete button.dataset.markdownFoldPosition;
    }

    function updateFoldButton(
      blockHandle: HTMLElement,
      button: HTMLButtonElement,
      target: MarkdownFoldTarget | null
    ) {
      if (!target || blockHandle.dataset.show !== "true") {
        hideFoldButton(blockHandle, button);
        return;
      }

      const action = target.collapsed ? "展开" : "折叠";
      const subject = target.kind === "heading" ? "章节" : "子列表";
      const normalizedLabel = target.label.trim().replace(/\s+/g, " ").slice(0, 48);
      const accessibleLabel = normalizedLabel ? `${action}${subject}“${normalizedLabel}”` : `${action}${subject}`;
      setFoldButtonVisible(blockHandle, button, true);
      button.dataset.markdownFoldKind = target.kind;
      button.dataset.markdownFoldPosition = String(target.position);
      button.setAttribute("aria-expanded", target.collapsed ? "false" : "true");
      button.setAttribute("aria-label", accessibleLabel);
      button.removeAttribute("aria-hidden");
      button.title = `${action}${subject}`;
      button.tabIndex = 0;
    }

    function handleFoldButtonClick(event: MouseEvent) {
      const button = event.currentTarget;
      if (!(button instanceof HTMLButtonElement)) return;
      const kind = button.dataset.markdownFoldKind as MarkdownFoldKind | undefined;
      const position = Number(button.dataset.markdownFoldPosition);
      if ((kind !== "heading" && kind !== "list-item") || !Number.isInteger(position)) return;

      event.preventDefault();
      event.stopPropagation();
      setBlockStyleMenu(null);
      const crepe = crepeRef.current;
      if (!crepe || crepe.editor.status !== EditorStatus.Created) return;
      crepe.editor.action((ctx) => {
        toggleMarkdownFold(ctx.get(editorViewCtx), { kind, position });
      });
      decorateBlockHandles();
    }

    function createFoldButton(blockHandle: HTMLElement) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "operation-item markdown-fold-handle-button";
      button.contentEditable = "false";
      button.draggable = false;
      button.hidden = true;
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("viewBox", "0 0 24 24");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M9 6l6 6-6 6");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-width", "1.5");
      svg.appendChild(path);
      button.appendChild(svg);

      const suppressBlockDrag = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      button.addEventListener("pointerdown", suppressBlockDrag);
      button.addEventListener("mousedown", suppressBlockDrag);
      button.addEventListener("dragstart", suppressBlockDrag);
      button.addEventListener("click", handleFoldButtonClick);
      blockHandle.appendChild(button);
      return button;
    }

    function decorateBlockHandles() {
      panelElement.querySelectorAll<HTMLElement>(".milkdown-block-handle").forEach((blockHandle) => {
        const operationItems = Array.from(
          blockHandle.querySelectorAll<HTMLElement>(":scope > .operation-item:not(.markdown-fold-handle-button)")
        );
        const addHandle = operationItems.length > 1 ? operationItems[0] : null;
        const dragHandle = operationItems[operationItems.length - 1];
        if (!dragHandle) return;

        if (addHandle) {
          addHandle.hidden = true;
          addHandle.setAttribute("aria-hidden", "true");
          addHandle.tabIndex = -1;
        }
        dragHandle.classList.add("markdown-block-style-handle");
        dragHandle.setAttribute("role", "button");
        dragHandle.setAttribute("aria-label", "块样式");
        const isVisible = blockHandle.dataset.show === "true";
        if (isVisible) dragHandle.removeAttribute("aria-hidden");
        else dragHandle.setAttribute("aria-hidden", "true");
        dragHandle.tabIndex = isVisible ? 0 : -1;

        const foldButton = blockHandle.querySelector<HTMLButtonElement>(":scope > .markdown-fold-handle-button")
          ?? createFoldButton(blockHandle);
        const resolved = isVisible ? resolveBlockHandlePosition(blockHandle) : null;
        const target = resolved ? findMarkdownFoldTarget(resolved.view.state, resolved.position) : null;
        updateFoldButton(blockHandle, foldButton, target);
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
        const position = resolveBlockHandlePosition(blockHandle)?.position ?? view.state.selection.from;
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
      style={{
        "--markdown-content-width": `${contentWidth}px`,
        "--markdown-text-scale": String(clampMarkdownTextScale(textScale))
      } as CSSProperties}
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
