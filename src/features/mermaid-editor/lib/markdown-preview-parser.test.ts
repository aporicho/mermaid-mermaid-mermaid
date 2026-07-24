import { describe, expect, it } from "vitest";

import { parseMarkdownPreview, parseMarkdownPreviewRuns } from "@/features/mermaid-editor/lib/markdown-preview-parser";

describe("lightweight Markdown canvas preview parser", () => {
  it("parses ATX and setext headings, paragraphs, bold text, lists, and quotes", () => {
    const blocks = parseMarkdownPreview(`# Title

Body with **bold** text.

## Details

- first
  - nested **item**
1. ordered
2. next

> A quoted **idea**
> continues here.
>
> A second paragraph.

Setext
------`);

    expect(blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "heading", "list", "blockquote", "heading"]);
    expect(blocks[0]).toMatchObject({ kind: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ kind: "paragraph", runs: [{ text: "Body with ", bold: false }, { text: "bold", bold: true }, { text: " text.", bold: false }] });
    expect(blocks[3]).toMatchObject({
      kind: "list",
      items: [
        { ordered: false, depth: 0 },
        { ordered: false, depth: 1 },
        { ordered: true, ordinal: 1 },
        { ordered: true, ordinal: 2 }
      ]
    });
    expect(blocks[4]).toMatchObject({
      kind: "blockquote",
      paragraphs: [
        [{ text: "A quoted ", bold: false }, { text: "idea", bold: true }, { text: " continues here.", bold: false }],
        [{ text: "A second paragraph.", bold: false }]
      ]
    });
    expect(blocks[5]).toMatchObject({ kind: "heading", level: 2 });
  });

  it("adds a document title only when the source has no level-one heading", () => {
    expect(parseMarkdownPreview("Body", "Document")[0]).toMatchObject({ kind: "heading", level: 1 });
    expect(parseMarkdownPreview("# Source title", "Document")).toHaveLength(1);
  });

  it("keeps loose unordered and ordered items in one list", () => {
    const blocks = parseMarkdownPreview(`- first

- second

1. third

2. fourth`);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: "list",
      items: [
        { ordered: false, ordinal: 0 },
        { ordered: false, ordinal: 0 },
        { ordered: true, ordinal: 1 },
        { ordered: true, ordinal: 2 }
      ]
    });
  });

  it("parses thematic breaks without overriding setext headings", () => {
    const blocks = parseMarkdownPreview(`Before

---

***

_ _ _

Setext
---`);

    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "divider", "divider", "divider", "heading"]);
    expect(blocks.at(-1)).toMatchObject({ kind: "heading", level: 2 });
  });

  it("degrades unsupported inline syntax to readable text", () => {
    expect(parseMarkdownPreviewRuns("[link](https://example.com), `code`, *em*, ~~old~~")).toEqual([
      { text: "link, code, em, old", bold: false }
    ]);
  });
});
