import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

type SystemFont = { family: string; monospace: boolean };
type FontListEntry = { familyName?: string; name?: string; monospace?: boolean };

const require = createRequire(import.meta.url);
const { normalizeSystemFonts, sanitizeFamilyName } = require("./system-fonts.cjs") as {
  normalizeSystemFonts: (fonts: FontListEntry[]) => SystemFont[];
  sanitizeFamilyName: (value: unknown) => string;
};

describe("system font catalog", () => {
  it("sanitizes, normalizes and deduplicates font families", () => {
    const fonts = normalizeSystemFonts([
      { familyName: '"Noto Sans SC"' },
      { familyName: "Maple Mono", monospace: false },
      { familyName: "ｍａｐｌｅ ｍｏｎｏ", monospace: true },
      { familyName: "\u0000Unsafe\u007f Font" },
      { familyName: "   " }
    ]);

    expect(fonts).toEqual(expect.arrayContaining([
      { family: "Noto Sans SC", monospace: false },
      { family: "Maple Mono", monospace: true },
      { family: "Unsafe Font", monospace: false }
    ]));
    expect(fonts.filter((font) => font.family.toLocaleLowerCase() === "maple mono")).toHaveLength(1);
  });

  it("rejects non-string values and bounds family names", () => {
    expect(sanitizeFamilyName(null)).toBe("");
    expect(sanitizeFamilyName("a".repeat(300))).toHaveLength(256);
  });
});
