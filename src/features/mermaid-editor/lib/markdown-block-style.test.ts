import { Schema, type Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { history, undo } from "@milkdown/kit/prose/history";
import { EditorState, type Plugin, type Transaction } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { describe, expect, it, vi } from "vitest";

import {
  convertMarkdownBlock,
  getMarkdownBlockStyle
} from "@/features/mermaid-editor/lib/markdown-block-style";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    paragraph: { content: "inline*", group: "block" },
    heading: { attrs: { level: { default: 1 } }, content: "inline*", group: "block" },
    code_block: { content: "text*", group: "block", marks: "" },
    blockquote: { content: "block+", group: "block" },
    bullet_list: { content: "list_item+", group: "block" },
    ordered_list: { attrs: { order: { default: 1 } }, content: "list_item+", group: "block" },
    list_item: {
      attrs: {
        checked: { default: null },
        label: { default: "•" },
        listType: { default: "bullet" }
      },
      content: "paragraph block*"
    }
  },
  marks: {
    strong: {}
  }
});

function paragraph(value: string, strong = false) {
  const marks = strong ? [schema.marks.strong.create()] : undefined;
  return schema.node("paragraph", null, value ? [schema.text(value, marks)] : undefined);
}

function listItem(value: string, checked: boolean | null = null) {
  return schema.node("list_item", { checked }, [paragraph(value)]);
}

function createNestedListItem(value: string, nestedList: ProseMirrorNode) {
  return schema.node("list_item", null, [paragraph(value), nestedList]);
}

function findTextPosition(doc: ProseMirrorNode, value: string) {
  let result: number | null = null;
  doc.descendants((node, position) => {
    if (node.isTextblock && node.textContent === value) {
      result = position + 1;
      return false;
    }
    return result == null;
  });
  if (result == null) throw new Error(`Text block not found: ${value}`);
  return result;
}

function createViewWithPlugins(blocks: ProseMirrorNode[], plugins: Plugin[] = []) {
  const view = {
    state: EditorState.create({ doc: schema.node("doc", null, blocks), plugins }),
    dispatch(transaction: Transaction) {
      view.state = view.state.apply(transaction);
    },
    focus: vi.fn()
  } as unknown as EditorView;

  return view;
}

function createView(...blocks: ProseMirrorNode[]) {
  return createViewWithPlugins(blocks);
}

describe("markdown block style commands", () => {
  it("changes a paragraph to a heading while preserving inline text and marks", () => {
    const view = createView(paragraph("Preserved", true));

    expect(convertMarkdownBlock(view, 0, "heading-3")).toBe(true);

    const heading = view.state.doc.firstChild;
    expect(heading?.type.name).toBe("heading");
    expect(heading?.attrs.level).toBe(3);
    expect(heading?.textContent).toBe("Preserved");
    expect(heading?.firstChild?.marks[0]?.type.name).toBe("strong");
  });

  it("switches an ordered list to task items without losing any item text", () => {
    const orderedList = schema.node("ordered_list", { order: 3 }, [listItem("Alpha"), listItem("Beta")]);
    const view = createView(orderedList);

    expect(convertMarkdownBlock(view, 0, "task-list")).toBe(true);

    const taskList = view.state.doc.firstChild;
    expect(taskList?.type.name).toBe("bullet_list");
    expect(taskList?.textContent).toBe("AlphaBeta");
    expect(taskList?.child(0).attrs.checked).toBe(false);
    expect(taskList?.child(1).attrs.checked).toBe(false);
    expect(getMarkdownBlockStyle(view.state, 0)).toBe("task-list");
  });

  it("does not rewrite a block that already has the selected style", () => {
    const orderedList = schema.node("ordered_list", { order: 7 }, [listItem("Seventh")]);
    const view = createView(orderedList);
    const originalDocument = view.state.doc;

    expect(convertMarkdownBlock(view, 0, "ordered-list")).toBe(true);

    expect(view.state.doc).toBe(originalDocument);
    expect(view.state.doc.firstChild?.attrs.order).toBe(7);
  });

  it("lifts only the clicked list item when changing it to body text", () => {
    const taskList = schema.node("bullet_list", null, [listItem("One", true), listItem("Two", false)]);
    const view = createView(taskList);

    expect(convertMarkdownBlock(view, findTextPosition(view.state.doc, "One"), "paragraph")).toBe(true);

    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe("paragraph");
    expect(view.state.doc.child(0).textContent).toBe("One");
    expect(view.state.doc.child(1).type.name).toBe("bullet_list");
    expect(view.state.doc.child(1).childCount).toBe(1);
    expect(view.state.doc.child(1).textContent).toBe("Two");
  });

  it("continues ordered-list numbering after lifting a middle item", () => {
    const orderedList = schema.node("ordered_list", { order: 7 }, [
      listItem("Seven"),
      listItem("Eight"),
      listItem("Nine"),
      listItem("Ten")
    ]);
    const view = createView(orderedList);

    expect(convertMarkdownBlock(view, findTextPosition(view.state.doc, "Eight"), "heading-2")).toBe(true);

    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.child(0).type.name).toBe("ordered_list");
    expect(view.state.doc.child(0).attrs.order).toBe(7);
    expect(view.state.doc.child(0).textContent).toBe("Seven");
    expect(view.state.doc.child(1).type.name).toBe("heading");
    expect(view.state.doc.child(1).textContent).toBe("Eight");
    expect(view.state.doc.child(2).type.name).toBe("ordered_list");
    expect(view.state.doc.child(2).attrs.order).toBe(9);
    expect(view.state.doc.child(2).textContent).toBe("NineTen");
  });

  it("splits a multi-item list around the clicked item and preserves its nested list", () => {
    const nested = schema.node("bullet_list", null, [listItem("Nested A"), listItem("Nested B")]);
    const list = schema.node("bullet_list", null, [
      listItem("Before"),
      createNestedListItem("Target", nested),
      listItem("After")
    ]);
    const view = createView(list);

    expect(convertMarkdownBlock(view, findTextPosition(view.state.doc, "Target"), "heading-2")).toBe(true);

    expect(view.state.doc.childCount).toBe(4);
    expect(view.state.doc.child(0).type.name).toBe("bullet_list");
    expect(view.state.doc.child(0).textContent).toBe("Before");
    expect(view.state.doc.child(1).type.name).toBe("heading");
    expect(view.state.doc.child(1).attrs.level).toBe(2);
    expect(view.state.doc.child(1).textContent).toBe("Target");
    expect(view.state.doc.child(2).eq(nested)).toBe(true);
    expect(view.state.doc.child(3).type.name).toBe("bullet_list");
    expect(view.state.doc.child(3).textContent).toBe("After");
    expect(view.state.doc.textContent).toBe("BeforeTargetNested ANested BAfter");
  });

  it("converts a nested item in place without flattening its surrounding list hierarchy", () => {
    const nested = schema.node("bullet_list", null, [listItem("Nested A"), listItem("Nested Target")]);
    const outer = schema.node("bullet_list", null, [createNestedListItem("Parent", nested)]);
    const view = createView(outer);

    expect(convertMarkdownBlock(view, findTextPosition(view.state.doc, "Nested Target"), "code-block")).toBe(true);

    const outerItem = view.state.doc.firstChild?.firstChild;
    expect(view.state.doc.firstChild?.type.name).toBe("bullet_list");
    expect(outerItem?.type.name).toBe("list_item");
    expect(outerItem?.child(0).textContent).toBe("Parent");
    expect(outerItem?.child(1).type.name).toBe("bullet_list");
    expect(outerItem?.child(1).textContent).toBe("Nested A");
    expect(outerItem?.child(2).type.name).toBe("code_block");
    expect(outerItem?.child(2).textContent).toBe("Nested Target");
  });

  it("changes the nearest whole list type while preserving items and nested descendants", () => {
    const nested = schema.node("bullet_list", null, [listItem("Child")]);
    const list = schema.node("bullet_list", null, [listItem("First"), createNestedListItem("Second", nested)]);
    const view = createView(list);

    expect(convertMarkdownBlock(view, findTextPosition(view.state.doc, "Second"), "ordered-list")).toBe(true);

    const ordered = view.state.doc.firstChild;
    expect(ordered?.type.name).toBe("ordered_list");
    expect(ordered?.childCount).toBe(2);
    expect(ordered?.child(0).textContent).toBe("First");
    expect(ordered?.child(1).textContent).toBe("SecondChild");
    expect(ordered?.child(1).child(1).eq(nested)).toBe(true);
    expect(view.state.doc.textContent).toBe("FirstSecondChild");
  });

  it("restores a split list and nested descendants with one undo", () => {
    const nested = schema.node("bullet_list", null, [listItem("Child")]);
    const list = schema.node("bullet_list", null, [
      listItem("Before"),
      createNestedListItem("Target", nested),
      listItem("After")
    ]);
    const view = createViewWithPlugins([list], [history()]);
    const original = view.state.doc;

    expect(convertMarkdownBlock(view, findTextPosition(view.state.doc, "Target"), "blockquote")).toBe(true);
    expect(view.state.doc.eq(original)).toBe(false);
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(view.state.doc.eq(original)).toBe(true);
  });

  it("converts a quote to code blocks and keeps its literal text", () => {
    const quote = schema.node("blockquote", null, [paragraph("const answer = 42")]);
    const view = createView(quote);

    expect(convertMarkdownBlock(view, 0, "code-block")).toBe(true);

    expect(view.state.doc.firstChild?.type.name).toBe("code_block");
    expect(view.state.doc.firstChild?.textContent).toBe("const answer = 42");
  });
});
