import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const UI_COMPONENTS = [
  "accordion",
  "alert-dialog",
  "alert",
  "context-menu",
  "field",
  "input-group",
  "radio-group",
  "skeleton",
  "slider",
  "sonner",
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
    expect(config.iconLibrary).toBe("iconoir");
    expect(config.tailwind.config).toBe("tailwind.config.ts");
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

  it("preserves the existing customized component layer", () => {
    expect(readProjectFile("src/components/ui/button.tsx")).toContain("editor-ui-control");
    expect(readProjectFile("src/components/ui/dialog.tsx")).toContain("useOverlayPortalContainer");
    expect(readProjectFile("src/components/ui/select.tsx")).toContain("useOverlayPortalContainer");
    expect(readProjectFile("src/components/ui/sheet.tsx")).toContain("useOverlayPortalContainer");
    expect(readProjectFile("src/components/ui/sidebar.tsx")).toContain("SidebarProvider");
  });

  it("routes finite business choices through the shadcn toggle group", () => {
    const projectDocumentDialog = readProjectFile("src/features/mermaid-editor/components/project-document-node-dialog.tsx");
    const explorer = readProjectFile("src/features/mermaid-editor/components/explorer-panel.tsx");
    const editorToolbar = readProjectFile("src/features/mermaid-editor/components/editor-ui/toolbar.tsx");

    for (const source of [projectDocumentDialog, explorer]) {
      expect(source).toContain('from "@/components/ui/toggle-group"');
      expect(source).toContain('type="single"');
      expect(source).toContain("if (value)");
      expect(source).not.toContain("EditorSegmentedControl");
    }
    expect(explorer).toContain("disabled={projectBusy}");
    expect(editorToolbar).not.toContain("EditorSegmentedControl");
  });
});
