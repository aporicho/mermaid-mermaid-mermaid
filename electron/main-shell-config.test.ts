import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.cjs", import.meta.url), "utf8");

describe("Electron main window shell config", () => {
  it("uses a frameless desktop window while preserving Windows thick-frame behavior", () => {
    expect(mainSource).toContain("frame: false");
    expect(mainSource).toContain("thickFrame: true");
  });

  it("quits the app after the last window closes on every platform", () => {
    expect(mainSource).toContain("app.on(\"window-all-closed\", () => {\n  app.quit();\n});");
    expect(mainSource).not.toContain("process.platform !== \"darwin\"");
  });
});
