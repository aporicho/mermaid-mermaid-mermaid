import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const UI_COMPONENTS = [
  "accordion",
  "alert-dialog",
  "alert",
  "button-group",
  "context-menu",
  "field",
  "input-group",
  "kbd",
  "radio-group",
  "skeleton",
  "slider",
  "sonner",
  "tabs",
  "toggle-group",
  "toggle"
] as const;

function projectPath(path: string) {
  return join(process.cwd(), path);
}

function readProjectFile(path: string) {
  return readFileSync(projectPath(path), "utf8");
}

describe("shadcn foundation contract", () => {
  it("describes this Vite application and its Iconoir icon policy", () => {
    const config = JSON.parse(readProjectFile("components.json"));

    expect(config.rsc).toBe(false);
    expect(config.style).toBe("radix-nova");
    expect(config.iconLibrary).toBe("iconoir");
    expect(config.tailwind.config).toBe("");
    expect(config.tailwind.css).toBe("src/styles/globals.css");
  });

  it("keeps the selected registry primitives available without Lucide or fixed z-index utilities", () => {
    for (const name of UI_COMPONENTS) {
      const path = `src/components/ui/${name}.tsx`;

      expect(existsSync(projectPath(path)), `${path} should exist`).toBe(true);
      const source = readProjectFile(path);
      expect(source).not.toContain("lucide-react");
      expect(source).not.toMatch(/\bz-\d+\b/);
    }
  });

  it("routes modal and menu portals through the application overlay scope", () => {
    for (const name of ["alert-dialog", "context-menu"] as const) {
      const source = readProjectFile(`src/components/ui/${name}.tsx`);

      expect(source).toContain("useOverlayPortalContainer");
      expect(source).toContain("OVERLAY_Z_INDEX");
      expect(source).toContain("data-overlay-scope-id");
    }
  });

  it("keeps Nova slots and the existing application extensions", () => {
    const button = readProjectFile("src/components/ui/button.tsx");
    expect(button).toContain('data-slot="button"');
    expect(button).toContain("--ui-control-height-md");
    expect(readProjectFile("src/components/ui/dialog.tsx")).toContain("useOverlayPortalContainer");
    expect(readProjectFile("src/components/ui/select.tsx")).toContain("useOverlayPortalContainer");
    expect(readProjectFile("src/components/ui/sheet.tsx")).toContain("useOverlayPortalContainer");
    expect(readProjectFile("src/components/ui/sidebar.tsx")).toContain("SidebarProvider");
  });

  it("keeps every tabs trigger at the standard themed control size", () => {
    const tabs = readProjectFile("src/components/ui/tabs.tsx");

    expect(tabs).toContain("min-h-[var(--ui-control-height-md)]");
    expect(tabs).toContain("px-[var(--ui-control-padding-x)]");
    expect(tabs).toContain("py-[var(--ui-control-padding-y)]");
    expect(tabs).toContain("min-h-[calc(var(--ui-control-height-md)+6px)]");
    expect(tabs).not.toContain("py-0.5");
    expect(tabs).not.toContain("calc(var(--ui-control-padding-x)*.6)");
  });

  it("lets nested accordion content grow after opening", () => {
    const accordion = readProjectFile("src/components/ui/accordion.tsx");

    expect(accordion).toContain("data-open:animate-accordion-down");
    expect(accordion).not.toContain("h-(--radix-accordion-content-height)");
  });

  it("hides native number input spinners globally", () => {
    const styles = readProjectFile("src/styles/globals.css");

    expect(styles).toContain('input[type="number"]');
    expect(styles).toContain('input[type="number"]::-webkit-inner-spin-button');
    expect(styles).toContain('input[type="number"]::-webkit-outer-spin-button');
    expect(styles).toContain("-moz-appearance: textfield");
    expect(styles).toContain("-webkit-appearance: none");
  });

  it("routes finite business choices through the shadcn toggle group", () => {
    const projectDocumentDialog = readProjectFile("src/features/mermaid-editor/components/project-document-node-dialog.tsx");
    const explorer = readProjectFile("src/features/mermaid-editor/components/explorer-panel.tsx");
    const explorerDialogs = readProjectFile("src/features/mermaid-editor/components/explorer-panel-dialogs.tsx");
    const editorToolbar = readProjectFile("src/features/mermaid-editor/components/editor-ui/toolbar.tsx");

    for (const source of [projectDocumentDialog, explorerDialogs]) {
      expect(source).toContain('from "@/components/ui/toggle-group"');
      expect(source).toContain('type="single"');
      expect(source).toContain("if (value)");
      expect(source).not.toContain("EditorSegmentedControl");
    }
    expect(explorer).toContain("disabled={projectBusy}");
    expect(editorToolbar).not.toContain("EditorSegmentedControl");
  });
});
