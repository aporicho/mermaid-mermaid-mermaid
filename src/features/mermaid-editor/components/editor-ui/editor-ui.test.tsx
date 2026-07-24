// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  EditorConfirmDialog,
  EditorDialog,
  EditorIconButton,
  EditorMenuToggleItem,
  EditorPointMenu,
  EditorSegmentedControl,
  EditorSegmentedControlItem,
  EditorToolbar
} from "@/features/mermaid-editor/components/editor-ui";

describe("editor UI semantic components", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("provides labelled toolbar actions and explicit pressed state", () => {
    act(() => {
      root.render(
        <TooltipProvider delayDuration={0}>
          <EditorToolbar aria-label="测试工具栏">
            <EditorIconButton label="对齐" context="toolbar" pressed><span>图标</span></EditorIconButton>
          </EditorToolbar>
        </TooltipProvider>
      );
    });

    expect(container.querySelector('[role="toolbar"]')?.getAttribute("aria-label")).toBe("测试工具栏");
    expect(container.querySelector('button[aria-label="对齐"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("shares selected and toggle semantics across controls", () => {
    const onCheckedChange = vi.fn();
    act(() => {
      root.render(
        <>
          <EditorSegmentedControl>
            <EditorSegmentedControlItem active>当前</EditorSegmentedControlItem>
            <EditorSegmentedControlItem active={false}>其他</EditorSegmentedControlItem>
          </EditorSegmentedControl>
          <EditorMenuToggleItem checked onCheckedChange={onCheckedChange} label="显示网格" />
        </>
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(["true", "false", "true"]);
    act(() => buttons[2].click());
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("uses the shared dialog structure and routes dismiss actions", () => {
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <EditorDialog open onOpenChange={onOpenChange} title="统一弹窗" description="说明" footer={<button>确认</button>}>
          正文
        </EditorDialog>
      );
    });

    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("统一弹窗");
    const closeButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="关闭"]');
    act(() => closeButton?.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps confirmation chrome quiet and separates danger from the primary action", () => {
    const onAction = vi.fn();
    act(() => {
      root.render(
        <EditorConfirmDialog
          open
          title="保存修改？"
          description="有一个文件尚未保存。"
          actions={[
            { id: "discard", label: "丢弃", tone: "danger" },
            { id: "cancel", label: "取消" },
            { id: "save", label: "保存", tone: "primary" }
          ]}
          primaryActionId="save"
          cancelActionId="cancel"
          onAction={onAction}
        >
          <p>文档.md</p>
        </EditorConfirmDialog>
      );
    });

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    const header = dialog?.querySelector("header");
    const footer = dialog?.querySelector("footer");
    const buttons = Array.from(dialog?.querySelectorAll("button") ?? []);
    const discard = buttons.find((button) => button.textContent === "丢弃");
    const save = buttons.find((button) => button.textContent === "保存");

    expect(header?.className).toContain("border-b-0");
    expect(footer?.className).toContain("border-t-0");
    expect(discard?.className).toContain("text-destructive");
    expect(discard?.className).not.toContain("bg-destructive text-destructive-foreground");
    expect(save?.className).toContain("bg-primary");
    expect(dialog?.querySelector('button[aria-label="关闭"]')).toBeNull();

    act(() => discard?.click());
    expect(onAction).toHaveBeenLastCalledWith("discard");
  });

  it("routes Enter to the primary action and Escape to cancellation", () => {
    const onAction = vi.fn();
    act(() => {
      root.render(
        <EditorConfirmDialog
          open
          title="确认操作"
          actions={[
            { id: "cancel", label: "取消" },
            { id: "confirm", label: "确认", tone: "primary" }
          ]}
          primaryActionId="confirm"
          cancelActionId="cancel"
          onAction={onAction}
        >
          正文
        </EditorConfirmDialog>
      );
    });

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    act(() => dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onAction).toHaveBeenLastCalledWith("confirm");

    act(() => dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(onAction.mock.calls).toEqual([["confirm"], ["cancel"]]);
  });

  it("provides a labelled point-anchored menu with standard menu items", () => {
    act(() => {
      root.render(
        <EditorPointMenu
          open
          point={{ x: 120, y: 80 }}
          onOpenChange={vi.fn()}
          ariaLabel="资源操作"
        >
          <DropdownMenuItem>重命名</DropdownMenuItem>
        </EditorPointMenu>
      );
    });

    const menu = document.body.querySelector('[role="menu"]');
    expect(menu?.getAttribute("aria-label")).toBe("资源操作");
    expect(menu?.querySelector('[role="menuitem"]')?.textContent).toBe("重命名");
  });
});
