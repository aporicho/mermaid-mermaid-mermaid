import { describe, expect, it } from "vitest";

import { importedGraphImageNodes } from "./image-import-placement";

describe("importedGraphImageNodes", () => {
  it("converts the centered image layout to top-left graph positions", () => {
    const nodes = importedGraphImageNodes([
      {
        asset: { status: "ready", src: "./assets/one.png", displaySrc: "/images/one.png", copied: true },
        dimensions: { width: 100, height: 80 }
      },
      {
        asset: { status: "ready", src: "./assets/two.png", displaySrc: "/images/two.png", copied: true },
        dimensions: { width: 160, height: 120 }
      }
    ], { x: 500, y: 400 });

    expect(nodes.map((node) => node.point)).toEqual([
      { x: 354, y: 360 },
      { x: 486, y: 340 }
    ]);
  });
});
