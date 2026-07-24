// @vitest-environment node

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { normalizeEmbeddedBrowserUrl, normalizeHttpUrl } = require("./embedded-browser-url.cjs") as {
  normalizeEmbeddedBrowserUrl: (value: unknown) => string;
  normalizeHttpUrl: (value: unknown) => string;
};

describe("embedded browser URL policy", () => {
  it("allows local HTML file URLs only for embedded surfaces", () => {
    expect(normalizeEmbeddedBrowserUrl("file:///tmp/demo.html")).toBe("file:///tmp/demo.html");
    expect(normalizeHttpUrl("file:///tmp/demo.html")).toBe("");
  });

  it("keeps http/https support and rejects script, data, and remote file hosts", () => {
    expect(normalizeEmbeddedBrowserUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(normalizeEmbeddedBrowserUrl("javascript:alert(1)")).toBe("");
    expect(normalizeEmbeddedBrowserUrl("data:text/html,hello")).toBe("");
    expect(normalizeEmbeddedBrowserUrl("file://remote-host/demo.html")).toBe("");
  });
});
