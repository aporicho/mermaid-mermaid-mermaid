// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TabsTrigger } from "@/components/ui/tabs";
import {
  EditorConfirmDialog,
  EditorDialog,
  EditorField,
  EditorIconButton,
  EditorMenuToggleItem,
  EditorPointMenu,
  EditorToolbar,
  SettingsAccordion,
  SettingsAccordionCard,
  SettingsTabs,
  SettingsTabsBody,
  SettingsTabsContent,
  SettingsTabsList
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

  it("keeps explicit selected semantics on menu toggles", () => {
    const onCheckedChange = vi.fn();
    act(() => {
      root.render(
        <EditorMenuToggleItem checked onCheckedChange={onCheckedChange} label="显示网格" />
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(["true"]);
    act(() => buttons[0].click());
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("connects field descriptions and errors to a direct form control", () => {
    act(() => {
      root.render(
        <EditorField label="文件名" htmlFor="field-file-name" description="需要扩展名" error="名称已存在">
          <Input id="field-file-name" />
        </EditorField>
      );
    });

    const input = container.querySelector<HTMLInputElement>("#field-file-name");
    const describedBy = input?.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toHaveLength(2);
    expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toEqual(["需要扩展名", "名称已存在"]);
    expect(input?.getAttribute("aria-invalid")).toBe("true");
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
    const closeButton = document.body.querySelector<HTMLButtonElement>('button[data-slot="dialog-close"]');
    act(() => closeButton?.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("uses native confirmation chrome and separates danger from the primary action", () => {
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

    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
    const header = dialog?.querySelector("[data-editor-confirm-header]");
    const footer = dialog?.querySelector("[data-editor-confirm-footer]");
    const buttons = Array.from(dialog?.querySelectorAll("button") ?? []);
    const discard = buttons.find((button) => button.textContent === "丢弃");
    const save = buttons.find((button) => button.textContent === "保存");

    expect(header?.getAttribute("data-slot")).toBe("alert-dialog-header");
    expect(footer?.getAttribute("data-slot")).toBe("alert-dialog-footer");
    expect(footer?.querySelectorAll('[data-slot="button-group"]')).toHaveLength(2);
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

    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
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

  it("composes settings from scrollable tabs and nested multi-open cards", () => {
    act(() => {
      root.render(
        <SettingsTabs defaultValue="appearance">
          <SettingsTabsList aria-label="设置分类">
            <TabsTrigger value="appearance">外观</TabsTrigger>
          </SettingsTabsList>
          <SettingsTabsBody>
            <SettingsTabsContent value="appearance">
              <SettingsAccordion defaultValue={[]}>
                <SettingsAccordionCard value="colors" title="颜色">颜色设置</SettingsAccordionCard>
                <SettingsAccordionCard value="layout" title="布局">
                  <SettingsAccordion defaultValue={[]}>
                    <SettingsAccordionCard value="spacing" title="间距">间距设置</SettingsAccordionCard>
                  </SettingsAccordion>
                </SettingsAccordionCard>
              </SettingsAccordion>
            </SettingsTabsContent>
          </SettingsTabsBody>
        </SettingsTabs>
      );
    });

    expect(container.querySelectorAll('[data-slot="scroll-area"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-settings-accordion-card]')).toHaveLength(2);
    const colors = container.querySelector<HTMLButtonElement>('button[aria-label="折叠或展开颜色"]');
    const layout = container.querySelector<HTMLButtonElement>('button[aria-label="折叠或展开布局"]');
    expect(colors?.getAttribute("aria-expanded")).toBe("false");
    expect(layout?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      colors?.click();
      layout?.click();
    });
    expect(colors?.getAttribute("aria-expanded")).toBe("true");
    expect(layout?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll('[data-settings-accordion-card]')).toHaveLength(3);
  });

  it("groups collapse and reset controls without making the card title interactive", () => {
    const onReset = vi.fn();
    act(() => {
      root.render(
        <TooltipProvider delayDuration={0}>
          <SettingsAccordion defaultValue={[]}>
            <SettingsAccordionCard
              value="appearance"
              title="外观"
              controlAction={(
                <EditorIconButton context="inline" variant="outline" label="重置外观" onClick={onReset}>
                  <span>重置</span>
                </EditorIconButton>
              )}
            >
              外观设置
            </SettingsAccordionCard>
          </SettingsAccordion>
        </TooltipProvider>
      );
    });

    const title = container.querySelector('[data-slot="card-title"]');
    const group = container.querySelector('[data-slot="button-group"]');
    const collapse = group?.querySelector<HTMLButtonElement>('button[aria-expanded]');
    const reset = group?.querySelector<HTMLButtonElement>('button[aria-label="重置外观"]');
    expect(title?.textContent).toBe("外观");
    expect(title?.closest("button")).toBeNull();
    expect(container.querySelector('[data-slot="card-action"]')?.className).toContain("row-span-1");
    expect(group?.querySelectorAll("button")).toHaveLength(2);
    expect(collapse?.getAttribute("aria-expanded")).toBe("false");

    act(() => reset?.click());
    expect(onReset).toHaveBeenCalledOnce();
    expect(collapse?.getAttribute("aria-expanded")).toBe("false");

    const header = container.querySelector<HTMLElement>("[data-settings-accordion-header]");
    act(() => header?.click());
    expect(collapse?.getAttribute("aria-expanded")).toBe("true");

    act(() => collapse?.click());
    expect(collapse?.getAttribute("aria-expanded")).toBe("false");
  });
});
