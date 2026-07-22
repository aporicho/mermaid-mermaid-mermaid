// @vitest-environment jsdom

import { Crepe } from "@milkdown/crepe";
import { Schema, type Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection } from "@milkdown/kit/prose/state";
import { EditorView } from "@milkdown/kit/prose/view";
import { afterEach, describe, expect, it } from "vitest";

import {
  collectHeadingFoldTargets,
  collectListFoldTargets,
  createMarkdownFoldingProsePlugin,
  markdownFolding,
  markdownFoldingProsePluginKey,
  type MarkdownFoldKind
} from "@/features/mermaid-editor/lib/markdown-folding";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0]
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: "inline*",
      group: "block",
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ attrs: { level }, tag: `h${level}` })),
      toDOM: (node) => [`h${node.attrs.level}`, 0]
    },
    bullet_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM: () => ["ul", 0]
    },
    ordered_list: {
      attrs: { order: { default: 1 } },
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ol" }],
      toDOM: (node) => ["ol", node.attrs.order === 1 ? {} : { start: node.attrs.order }, 0]
    },
    list_item: {
      content: "paragraph block*",
      parseDOM: [{ tag: "li" }],
      toDOM: () => ["li", 0]
    }
  }
});

const mountedViews: EditorView[] = [];

afterEach(() => {
  mountedViews.splice(0).forEach((view) => view.destroy());
  document.body.replaceChildren();
});

function textNode(type: "paragraph" | "heading", value: string, level = 1) {
  const attrs = type === "heading" ? { level } : null;
  return schema.node(type, attrs, value ? [schema.text(value)] : undefined);
}

function paragraph(value: string) {
  return textNode("paragraph", value);
}

function heading(level: number, value: string) {
  return textNode("heading", value, level);
}

function listItem(value: string, nested?: ProseMirrorNode) {
  return schema.node("list_item", null, [paragraph(value), ...(nested ? [nested] : [])]);
}

function bulletList(...items: ProseMirrorNode[]) {
  return schema.node("bullet_list", null, items);
}

function createDocument(...blocks: ProseMirrorNode[]) {
  return schema.node("doc", null, blocks);
}

function createView(doc: ProseMirrorNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const state = EditorState.create({ doc, plugins: [createMarkdownFoldingProsePlugin()] });
  const view = new EditorView(host, {
    state,
    dispatchTransaction(transaction) {
      view.updateState(view.state.apply(transaction));
    }
  });
  mountedViews.push(view);
  return view;
}

function toggle(view: EditorView, kind: MarkdownFoldKind, position: number) {
  view.dispatch(view.state.tr.setMeta(markdownFoldingProsePluginKey, {
    kind,
    position,
    type: "toggle"
  }));
}

describe("markdown hierarchy folding", () => {
  it("integrates with Crepe heading and list-item node views", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const crepe = new Crepe({
      root,
      defaultValue: "# Section\n\nBody\n\n- Parent\n    - Child",
      features: { [Crepe.Feature.Cursor]: false }
    });
    crepe.editor.use(markdownFolding);

    try {
      await crepe.create();

      const headingButton = root.querySelector<HTMLButtonElement>(
        'h1 > button[data-markdown-fold-kind="heading"]'
      );
      const listButton = root.querySelector<HTMLButtonElement>(
        'button[data-markdown-fold-kind="list-item"]'
      );
      expect(headingButton).not.toBeNull();
      expect(listButton).not.toBeNull();
      expect(listButton?.closest(".milkdown-list-item-block.markdown-fold-list-parent")).not.toBeNull();
      expect(listButton?.parentElement?.classList.contains("content-dom")).toBe(true);

      listButton?.click();
      expect(root.querySelectorAll(".milkdown-list-item-block.markdown-fold-list-parent--collapsed")).toHaveLength(1);
      expect(crepe.getMarkdown()).toContain("Child");
    } finally {
      await crepe.destroy();
    }
  });

  it("collects heading sections up to the next heading of the same or higher level", () => {
    const doc = createDocument(
      heading(1, "A"),
      paragraph("A body"),
      heading(2, "A.1"),
      paragraph("A.1 body"),
      heading(1, "B"),
      paragraph("B body")
    );

    const targets = collectHeadingFoldTargets(doc);

    expect(targets.map((target) => target.label)).toEqual(["A", "A.1", "B"]);
    expect(doc.textBetween(targets[0]!.contentFrom, targets[0]!.contentTo, " ")).toContain("A.1 body");
    expect(doc.textBetween(targets[0]!.contentFrom, targets[0]!.contentTo, " ")).not.toContain("B body");
  });

  it("folds a heading section without changing the Markdown document content", () => {
    const view = createView(createDocument(
      heading(1, "First"),
      paragraph("First body"),
      heading(2, "Child"),
      paragraph("Child body"),
      heading(1, "Second"),
      paragraph("Second body")
    ));
    const originalDocument = view.state.doc;
    const button = view.dom.querySelector<HTMLButtonElement>('button[data-markdown-fold-kind="heading"]');

    expect(button?.getAttribute("aria-expanded")).toBe("true");
    button?.click();

    expect(view.state.doc).toBe(originalDocument);
    expect(view.dom.querySelectorAll(".markdown-fold-hidden")).toHaveLength(3);
    expect(view.dom.querySelectorAll("h1.markdown-fold-hidden")).toHaveLength(0);
    expect(view.dom.querySelector<HTMLButtonElement>('button[data-markdown-fold-kind="heading"]')?.getAttribute("aria-expanded"))
      .toBe("false");
  });

  it("moves a selection out of content before hiding that section", () => {
    const view = createView(createDocument(heading(1, "Section"), paragraph("Selected body")));
    const [target] = collectHeadingFoldTargets(view.state.doc);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target!.contentFrom + 1)));

    view.dom.querySelector<HTMLButtonElement>('button[data-markdown-fold-kind="heading"]')?.click();

    expect(view.state.selection.from).toBeLessThan(target!.contentFrom);
    expect(markdownFoldingProsePluginKey.getState(view.state)?.collapsedHeadings.has(target!.position)).toBe(true);
  });

  it("folds only direct nested lists and preserves every list item", () => {
    const nested = bulletList(listItem("Child one"), listItem("Child two"));
    const view = createView(createDocument(bulletList(listItem("Parent", nested), listItem("Sibling"))));
    const [target] = collectListFoldTargets(view.state.doc);
    const originalDocument = view.state.doc;

    expect(target?.label).toBe("Parent");
    toggle(view, "list-item", target!.position);

    expect(view.state.doc).toBe(originalDocument);
    expect(view.state.doc.textContent).toBe("ParentChild oneChild twoSibling");
    expect(view.dom.querySelectorAll("li.markdown-fold-list-parent--collapsed")).toHaveLength(1);
    expect(markdownFoldingProsePluginKey.getState(view.state)?.collapsedListItems.has(target!.position)).toBe(true);
  });

  it("keeps a collapsed heading attached when blocks are inserted before it", () => {
    const view = createView(createDocument(heading(2, "Stable"), paragraph("Body")));
    const [target] = collectHeadingFoldTargets(view.state.doc);
    toggle(view, "heading", target!.position);

    const prefix = paragraph("Prefix");
    view.dispatch(view.state.tr.insert(0, prefix));

    const mappedPosition = prefix.nodeSize + target!.position;
    const foldingState = markdownFoldingProsePluginKey.getState(view.state);
    expect(foldingState?.collapsedHeadings.has(mappedPosition)).toBe(true);
    expect(foldingState?.collapsedHeadings.has(target!.position)).toBe(false);
  });

  it("drops stale fold state after a nested list is removed", () => {
    const nested = bulletList(listItem("Child"));
    const view = createView(createDocument(bulletList(listItem("Parent", nested))));
    const [target] = collectListFoldTargets(view.state.doc);
    toggle(view, "list-item", target!.position);

    const parentItem = view.state.doc.nodeAt(target!.position)!;
    const nestedList = parentItem.child(1);
    const nestedStart = target!.position + 1 + parentItem.child(0).nodeSize;
    view.dispatch(view.state.tr.delete(nestedStart, nestedStart + nestedList.nodeSize));

    expect(markdownFoldingProsePluginKey.getState(view.state)?.collapsedListItems.size).toBe(0);
    expect(collectListFoldTargets(view.state.doc)).toHaveLength(0);
  });
});
