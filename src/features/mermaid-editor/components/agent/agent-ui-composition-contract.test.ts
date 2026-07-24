import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const PANEL_PATH = "src/features/mermaid-editor/components/agent/agent-panel.tsx";
const SETTINGS_PATH = "src/features/mermaid-editor/components/agent/agent-settings-dialog.tsx";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function functionSource(source: string, name: string, nextName: string) {
  return source.slice(source.indexOf(`function ${name}`), source.indexOf(`function ${nextName}`));
}

function jsxTagName(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement) {
  return ts.isIdentifier(node.tagName) ? node.tagName.text : undefined;
}

function buttonIconViolations(path: string) {
  const source = readProjectFile(path);
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const iconNames = new Set<string>();
  const buttonComponents = new Set(["Button", "EditorIconButton", "IconButton", "InputGroupButton", "TabsTrigger"]);
  const violations: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.getText(sourceFile) !== '"iconoir-react/regular"') continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) iconNames.add(element.name.text);
  }

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const iconName = jsxTagName(opening);
      if (iconName && iconNames.has(iconName)) {
        let ancestor: ts.Node | undefined = node.parent;
        while (ancestor) {
          if (ts.isJsxElement(ancestor)) {
            const ancestorName = jsxTagName(ancestor.openingElement);
            if (ancestorName && buttonComponents.has(ancestorName)) {
              const attributes = opening.attributes.properties.filter(ts.isJsxAttribute);
              const hasDataIcon = attributes.some((attribute) => attribute.name.getText(sourceFile) === "data-icon");
              const hasCallerSize = attributes.some((attribute) => attribute.name.getText(sourceFile) === "className" && /(?:size-|\bh-|\bw-)/.test(attribute.getText(sourceFile)));
              const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
              if (!hasDataIcon) violations.push(`${path}:${line} ${iconName} is missing data-icon`);
              if (hasCallerSize) violations.push(`${path}:${line} ${iconName} overrides its shadcn size`);
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

describe("Agent shadcn composition contract", () => {
  it("uses shared feedback, empty, search, and form primitives", () => {
    const panel = readProjectFile(PANEL_PATH);
    const settings = readProjectFile(SETTINGS_PATH);

    expect(panel).toContain('from "@/components/ui/alert"');
    expect(panel).toContain('from "@/components/ui/input-group"');
    expect(panel).toContain('from "@/components/ui/marker"');
    expect(functionSource(panel, "AgentStatus", "AgentSessionSidebar")).toContain("<Alert");
    expect(functionSource(panel, "AgentNotice", "MarkdownContent")).toContain("<Marker");
    expect(panel).toContain("<InputGroupInput");
    expect(functionSource(panel, "AgentComposer", "ModelCombobox")).toContain("<InputGroupTextarea");
    expect(functionSource(panel, "RenameSessionDialog", "DeleteSessionDialog")).toContain("<FieldGroup");
    expect(functionSource(panel, "RenameSessionDialog", "DeleteSessionDialog")).toContain("<DialogFooter");
    expect(functionSource(panel, "AgentInteractionDialog", "IconButton")).toContain("<DialogHeader");

    expect(settings).toContain('from "@/components/ui/field"');
    expect(settings).toContain('from "@/components/ui/input-group"');
    expect(settings).toContain("<FieldGroup");
    expect(settings).toContain("<FieldSet");
    expect(settings).toContain("<ToggleGroup");
    expect(settings).toContain("<DialogFooter");
    expect(settings).not.toContain("function Field(");
    expect(functionSource(settings, "InlineEmpty", "Notice")).toContain("<Empty");
    expect(functionSource(settings, "Notice", "toolName")).toContain("<Alert");
    expect(settings).not.toContain("<Section title=");
  });

  it("does not restyle Nova controls at Agent call sites", () => {
    const panel = readProjectFile(PANEL_PATH);
    const settings = readProjectFile(SETTINGS_PATH);

    expect(panel).not.toContain('border-0 bg-transparent px-2');
    expect(panel).not.toContain('className="size-4" aria-label="移除引用"');
    expect(settings).not.toContain("rounded-none border-r bg-muted/25");
    expect(settings).not.toContain('data-[state=active]:bg-card');
    expect(settings).not.toContain('variant="ghost" className="text-destructive"');
  });

  it("lets shadcn buttons own Iconoir sizing and placement", () => {
    expect([
      ...buttonIconViolations(PANEL_PATH),
      ...buttonIconViolations(SETTINGS_PATH)
    ]).toEqual([]);
  });
});
