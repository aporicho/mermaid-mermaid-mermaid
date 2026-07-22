import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("application style contract", () => {
  it("loads global CSS and editor fonts from the Vite entry", () => {
    const main = readProjectFile("src/main.tsx");

    expect(main).toContain('import "@fontsource-variable/noto-sans-sc"');
    expect(main).toContain('import "@fontsource/maple-mono/400.css"');
    expect(main).toContain('import "@/styles/globals.css"');
  });

  it("keeps Tailwind scanning every application source surface", () => {
    const tailwindConfig = readProjectFile("tailwind.config.ts");

    expect(tailwindConfig).toContain("./index.html");
    expect(tailwindConfig).toContain("./src/**/*.{ts,tsx}");
    expect(tailwindConfig).toContain("./src/components/**/*.{ts,tsx}");
    expect(tailwindConfig).toContain("./src/features/**/*.{ts,tsx}");
    expect(tailwindConfig).toContain("./src/lib/**/*.{ts,tsx}");
  });

  it("keeps Tailwind and autoprefixer in the PostCSS pipeline", () => {
    const postcssConfig = readProjectFile("postcss.config.mjs");

    expect(postcssConfig).toContain("tailwindcss");
    expect(postcssConfig).toContain("autoprefixer");
  });

  it("keeps render and source surfaces behind theme css variables", () => {
    const globals = readProjectFile("src/styles/globals.css");

    expect(globals).toContain("--render-background");
    expect(globals).toContain("--render-grid-dot");
    expect(globals).toContain("--theme-source-line-height");
    expect(globals).toContain("hsl(var(--render-background))");
    expect(globals).toContain("hsl(var(--render-grid-dot)");
    expect(globals).toContain("var(--theme-source-line-height)");
  });

  it("prevents accidental UI text selection without blocking editable content", () => {
    const globals = readProjectFile("src/styles/globals.css");

    expect(globals).toContain("body {");
    expect(globals).toContain("user-select: none");
    expect(globals).toContain('[contenteditable="true"]');
    expect(globals).toContain(".ProseMirror");
    expect(globals).toContain(".monaco-editor");
    expect(globals).toContain(".xterm");
    expect(globals).toContain("user-select: text");
  });

  it("renders explorer tree rows as continuous borderless rows, not generic buttons", () => {
    const tree = readProjectFile("src/features/mermaid-editor/components/editor-ui/tree.tsx");

    expect(tree).toContain("<button");
    expect(tree).toContain("border-0 bg-transparent");
    expect(tree).not.toContain('from "@/components/ui/button"');
    expect(tree).not.toContain("rounded-[var(--theme-radius-control-sm)]");
  });

  it("styles Markdown lists through Crepe list-item node views", () => {
    const globals = readProjectFile("src/styles/globals.css");

    expect(globals).toContain("ul > .milkdown-list-item-block > .list-item");
    expect(globals).toContain("ul:has(> .milkdown-list-item-block > .list-item > .label-wrapper :is(.checked, .unchecked))");
    expect(globals).toContain(".ProseMirror :is(li, th, td) p");
    expect(globals).toContain(".label-wrapper .bullet svg");
    expect(globals).toContain(".label-wrapper :is(.checked, .unchecked) svg");
    expect(globals).toContain(".label-wrapper .checked::after");
  });

  it("keeps hierarchy folding compatible with Crepe list-item content DOM", () => {
    const globals = readProjectFile("src/styles/globals.css");

    expect(globals).toContain(".markdown-fold-list-parent--collapsed > .list-item > .children > .content-dom > :is(ul, ol)");
    expect(globals).toContain(".markdown-fold-list-parent:hover > .list-item > .children .markdown-fold-toggle");
    expect(globals).toContain(".markdown-fold-heading--collapsed > .markdown-fold-toggle");
  });

  it("packages Electron image assets through the desktop asset protocol", () => {
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const electronMain = readProjectFile("electron/main.cjs");
    const imageAssets = readProjectFile("electron/image-assets.cjs");

    expect(packageJson.build.win.icon).toBe("electron/icons/icon.ico");
    expect(packageJson.build.mac.icon).toBe("electron/icons/icon.icns");
    expect(packageJson.build.linux.icon).toBe("electron/icons/icon.png");
    expect(packageJson.build.artifactName).toBe("mermaid-canvas-editor-${version}-${os}-${arch}.${ext}");
    expect(imageAssets).toContain('const ASSET_PROTOCOL = "mmm-asset"');
    expect(electronMain).toContain("protocol.registerSchemesAsPrivileged");
    expect(electronMain).toContain("registerAssetProtocol");
  });
});
