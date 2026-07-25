import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

type CompositionRule = Readonly<{
  content: string;
  group: string;
}>;

const SOURCE_ROOT = join(process.cwd(), "src");
const ITEM_RULES: Readonly<Record<string, CompositionRule>> = {
  CommandItem: { content: "CommandList", group: "CommandGroup" },
  ContextMenuItem: { content: "ContextMenuContent", group: "ContextMenuGroup" },
  ContextMenuLabel: { content: "ContextMenuContent", group: "ContextMenuGroup" },
  DropdownMenuItem: { content: "DropdownMenuContent", group: "DropdownMenuGroup" },
  DropdownMenuLabel: { content: "DropdownMenuContent", group: "DropdownMenuGroup" },
  MixedSelectItem: { content: "SelectContent", group: "SelectGroup" },
  SelectItem: { content: "SelectContent", group: "SelectGroup" },
  SelectLabel: { content: "SelectContent", group: "SelectGroup" }
};

function productionTsxFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return productionTsxFiles(path);
    if (!entry.name.endsWith(".tsx") || entry.name.endsWith(".test.tsx")) return [];
    return [path];
  });
}

function jsxTagName(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement) {
  return ts.isIdentifier(node.tagName) ? node.tagName.text : undefined;
}

function compositionViolations(path: string) {
  const source = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const item = jsxTagName(opening);
      const rule = item ? ITEM_RULES[item] : undefined;
      if (item && rule) {
        let ancestor: ts.Node | undefined = node.parent;
        while (ancestor) {
          if (ts.isJsxElement(ancestor)) {
            const ancestorName = jsxTagName(ancestor.openingElement);
            if (ancestorName === rule.group) break;
            if (ancestorName === rule.content) {
              const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
              violations.push(`${relative(process.cwd(), path)}:${line} ${item} requires ${rule.group}`);
              break;
            }
          }
          ancestor = ancestor.parent;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

describe("shadcn composition contract", () => {
  it("keeps item primitives inside their matching groups", () => {
    const violations = productionTsxFiles(SOURCE_ROOT).flatMap(compositionViolations);

    expect(violations).toEqual([]);
  });

  it("groups point-menu children before placing them in DropdownMenuContent", () => {
    const source = readFileSync(
      join(SOURCE_ROOT, "features/mermaid-editor/components/editor-ui/point-menu.tsx"),
      "utf8"
    );

    expect(source).toContain("<DropdownMenuGroup>{children}</DropdownMenuGroup>");
  });

  it("uses shadcn context menus for root, directory, and file explorer rows", () => {
    const explorer = readFileSync(
      join(SOURCE_ROOT, "features/mermaid-editor/components/explorer-panel.tsx"),
      "utf8"
    );
    const contextMenu = readFileSync(
      join(SOURCE_ROOT, "features/mermaid-editor/components/explorer-panel-context-menu.tsx"),
      "utf8"
    );
    const explorerFileRow = readFileSync(
      join(SOURCE_ROOT, "features/mermaid-editor/components/explorer-panel-file-row.tsx"),
      "utf8"
    );

    expect(`${explorer}\n${explorerFileRow}`.match(/<ProjectResourceContextMenu\b/g)).toHaveLength(3);
    expect(contextMenu).toMatch(/<ContextMenuTrigger[^>]*\basChild\b[^>]*>/);
    expect(contextMenu).toContain("<ContextMenuContent");
    expect(contextMenu).toContain("<ContextMenuGroup>");
    expect(contextMenu).toContain("<ContextMenuItem");
    expect(contextMenu).toContain("<ContextMenuSeparator />");
    expect(`${explorer}\n${explorerFileRow}\n${contextMenu}`).not.toContain("EditorPointMenu");
    expect(`${explorer}\n${explorerFileRow}\n${contextMenu}`).not.toContain("setContextMenu");
  });
});
