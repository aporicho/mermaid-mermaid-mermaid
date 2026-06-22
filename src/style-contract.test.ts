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

  it("allows desktop image assets to load through the Tauri asset protocol", () => {
    const tauriConfig = JSON.parse(readProjectFile("src-tauri/tauri.conf.json"));

    expect(tauriConfig.app.security.assetProtocol).toEqual({
      enable: true,
      scope: ["**"]
    });
  });
});
