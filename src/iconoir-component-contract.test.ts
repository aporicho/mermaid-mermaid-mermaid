import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

import { describe, expect, it } from "vitest";

const ICON_HOSTS = new Set(["Alert", "Button", "CommandItem", "ContextMenuItem", "DropdownMenuItem", "EditorIconButton", "FloatingIconButton"]);
const FORBIDDEN_ICON_CLASS = /(?:^|[\s"'`])(?:size|w|h|mr)-[^\s"'`}]+/;

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionTsxFiles(path);
    return /\.tsx$/.test(entry.name) && !/(?:test|spec)\.tsx$/.test(entry.name) ? [path] : [];
  });
}

function jsxTagName(sourceFile: ts.SourceFile, name: ts.JsxTagNameExpression) {
  return ts.isIdentifier(name) ? name.text : name.getText(sourceFile);
}

function iconAttributes(node: ts.JsxElement | ts.JsxSelfClosingElement) {
  return ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
}

function directIconChildren(
  sourceFile: ts.SourceFile,
  node: ts.JsxElement,
  iconNames: ReadonlySet<string>
) {
  const icons: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];
  const isIcon = (candidate: ts.Node): candidate is ts.JsxElement | ts.JsxSelfClosingElement => {
    if (!ts.isJsxElement(candidate) && !ts.isJsxSelfClosingElement(candidate)) return false;
    const tagName = ts.isJsxElement(candidate) ? candidate.openingElement.tagName : candidate.tagName;
    return iconNames.has(jsxTagName(sourceFile, tagName));
  };

  for (const child of node.children) {
    if (isIcon(child)) {
      icons.push(child);
      continue;
    }
    if (!ts.isJsxExpression(child) || !child.expression) continue;
    const visitExpression = (candidate: ts.Node) => {
      if (isIcon(candidate)) {
        icons.push(candidate);
        return;
      }
      ts.forEachChild(candidate, visitExpression);
    };
    visitExpression(child.expression);
  }
  return icons;
}

describe("Iconoir component contract", () => {
  it("delegates direct action icon sizing and spacing to shared component tokens", () => {
    const violations: string[] = [];

    for (const file of productionTsxFiles(join(process.cwd(), "src"))) {
      const source = readFileSync(file, "utf8");
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const iconNames = new Set<string>();

      for (const statement of sourceFile.statements) {
        if (
          !ts.isImportDeclaration(statement)
          || !ts.isStringLiteral(statement.moduleSpecifier)
          || !statement.moduleSpecifier.text.startsWith("iconoir-react")
        ) continue;
        const namedBindings = statement.importClause?.namedBindings;
        if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;
        for (const element of namedBindings.elements) iconNames.add(element.name.text);
      }
      if (!iconNames.size) continue;

      const visit = (node: ts.Node) => {
        if (ts.isJsxElement(node) && ICON_HOSTS.has(jsxTagName(sourceFile, node.openingElement.tagName))) {
          for (const icon of directIconChildren(sourceFile, node, iconNames)) {
            const attributes = iconAttributes(icon);
            const dataIcon = attributes.properties.find(
              (attribute) => ts.isJsxAttribute(attribute) && ts.isIdentifier(attribute.name) && attribute.name.text === "data-icon"
            );
            const className = attributes.properties.find(
              (attribute) => ts.isJsxAttribute(attribute) && ts.isIdentifier(attribute.name) && attribute.name.text === "className"
            );
            const position = sourceFile.getLineAndCharacterOfPosition(icon.getStart(sourceFile));
            const location = `${file.slice(process.cwd().length + 1)}:${position.line + 1}`;

            if (!dataIcon) violations.push(`${location} 缺少 data-icon`);
            if (className && FORBIDDEN_ICON_CLASS.test(className.getText(sourceFile))) {
              violations.push(`${location} 仍在调用方设置图标尺寸或右间距`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  });
});
