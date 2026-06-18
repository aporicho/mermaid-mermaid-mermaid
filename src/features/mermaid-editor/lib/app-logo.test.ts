import { describe, expect, it } from "vitest";

import { APP_LOGOS, appLogoById, DEFAULT_APP_LOGO_ID, normalizeAppLogoId } from "@/features/mermaid-editor/lib/app-logo";

describe("app logo", () => {
  it("normalizes unknown stored values to the default logo", () => {
    expect(normalizeAppLogoId("dark")).toBe("dark");
    expect(normalizeAppLogoId("missing")).toBe(DEFAULT_APP_LOGO_ID);
    expect(normalizeAppLogoId(undefined)).toBe(DEFAULT_APP_LOGO_ID);
  });

  it("resolves every logo to a project asset", () => {
    expect(APP_LOGOS).toHaveLength(3);
    expect(APP_LOGOS.map((logo) => logo.href)).toEqual(["/logos/logo-green.svg", "/logos/logo-light.svg", "/logos/logo-dark.svg"]);
    expect(appLogoById(DEFAULT_APP_LOGO_ID).href).toBe("/logos/logo-green.svg");
  });
});
