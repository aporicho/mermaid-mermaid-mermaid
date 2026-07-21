import { Fragment, type Node as ProseMirrorNode, type NodeType, type Schema } from "@milkdown/kit/prose/model";
import { TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

export type MarkdownBlockStyle =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "blockquote"
  | "code-block";

type TopLevelBlock = {
  kind: "block";
  node: ProseMirrorNode;
  position: number;
};

type ListItemTarget = {
  kind: "list-item";
  item: ProseMirrorNode;
  itemIndex: number;
  itemPosition: number;
  list: ProseMirrorNode;
  listPosition: number;
};

type Replacement = {
  content: Fragment;
  from: number;
  selectionOffset: number;
  to: number;
};

const listStyles = new Set<MarkdownBlockStyle>(["bullet-list", "ordered-list", "task-list"]);

export function getMarkdownBlockStyle(state: EditorState, position: number): MarkdownBlockStyle | null {
  const listItem = findListItemTarget(state.doc, position);
  if (listItem) return getListItemStyle(listItem);

  const block = findTopLevelBlock(state.doc, position);
  return block ? getNodeStyle(block.node) : null;
}

export function convertMarkdownBlock(view: EditorView, position: number, style: MarkdownBlockStyle): boolean {
  const { state } = view;
  const listItem = findListItemTarget(state.doc, position);
  let replacement: Replacement | null = null;

  if (listItem) {
    if (isListStyle(style)) {
      if (listAlreadyMatchesStyle(listItem.list, style)) {
        view.focus();
        return true;
      }
      replacement = createListTypeReplacement(state, listItem, style);
    } else {
      replacement = createListItemBlockReplacement(state, listItem, style);
    }
  } else {
    const block = findTopLevelBlock(state.doc, position);
    if (!block) return false;
    if (getNodeStyle(block.node) === style) {
      view.focus();
      return true;
    }
    const content = createBlockReplacement(state, block.node, style);
    if (content) {
      replacement = {
        content,
        from: block.position,
        selectionOffset: 0,
        to: block.position + block.node.nodeSize
      };
    }
  }

  if (!replacement) return false;

  try {
    let transaction = state.tr.replaceWith(replacement.from, replacement.to, replacement.content);
    const selectionPosition = Math.min(
      replacement.from + replacement.selectionOffset + 1,
      transaction.doc.content.size
    );
    transaction = transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition), 1));
    view.dispatch(transaction.scrollIntoView());
    view.focus();
    return true;
  } catch {
    return false;
  }
}

function findListItemTarget(doc: ProseMirrorNode, position: number): ListItemTarget | null {
  const maxPosition = doc.content.size;
  const clamped = Math.max(0, Math.min(position, maxPosition));
  const probes = [clamped + 1, clamped, clamped - 1]
    .filter((probe, index, values) => probe >= 0 && probe <= maxPosition && values.indexOf(probe) === index);

  for (const probe of probes) {
    const $pos = doc.resolve(probe);
    for (let depth = $pos.depth; depth >= 1; depth -= 1) {
      const item = $pos.node(depth);
      if (item.type.name !== "list_item") continue;

      const listDepth = depth - 1;
      const list = $pos.node(listDepth);
      if (!isListNode(list)) continue;
      return {
        kind: "list-item",
        item,
        itemIndex: $pos.index(listDepth),
        itemPosition: $pos.before(depth),
        list,
        listPosition: listDepth === 0 ? 0 : $pos.before(listDepth)
      };
    }

    const item = $pos.nodeAfter;
    const list = $pos.parent;
    if (item?.type.name === "list_item" && isListNode(list)) {
      return {
        kind: "list-item",
        item,
        itemIndex: $pos.index(),
        itemPosition: probe,
        list,
        listPosition: $pos.depth === 0 ? 0 : $pos.before($pos.depth)
      };
    }
  }

  return null;
}

function findTopLevelBlock(doc: ProseMirrorNode, position: number): TopLevelBlock | null {
  if (doc.childCount === 0) return null;

  const clampedPosition = Math.max(0, Math.min(position, Math.max(0, doc.content.size - 1)));
  let offset = 0;

  for (let index = 0; index < doc.childCount; index += 1) {
    const node = doc.child(index);
    const end = offset + node.nodeSize;
    if (clampedPosition < end) return { kind: "block", node, position: offset };
    offset = end;
  }

  return null;
}

function createListItemBlockReplacement(
  state: EditorState,
  target: ListItemTarget,
  style: Exclude<MarkdownBlockStyle, "bullet-list" | "ordered-list" | "task-list">
): Replacement | null {
  const leadingBlock = target.item.firstChild;
  if (!leadingBlock?.isTextblock) return null;

  const beforeItems = childrenBetween(target.list, 0, target.itemIndex);
  const afterItems = childrenBetween(target.list, target.itemIndex + 1, target.list.childCount);
  const beforeList = createListSegment(target.list, beforeItems);
  const afterList = createListSegment(target.list, afterItems, beforeItems.length + 1);
  const tail = childrenBetween(target.item, 1, target.item.childCount);
  const converted = createSingleBlockStyle(state.schema, leadingBlock, tail, style);
  if (!converted) return null;

  const nodes = [beforeList, ...converted, afterList].filter((node): node is ProseMirrorNode => Boolean(node));
  return {
    content: Fragment.fromArray(nodes),
    from: target.listPosition,
    selectionOffset: beforeList?.nodeSize ?? 0,
    to: target.listPosition + target.list.nodeSize
  };
}

function createListTypeReplacement(
  state: EditorState,
  target: ListItemTarget,
  style: Extract<MarkdownBlockStyle, "bullet-list" | "ordered-list" | "task-list">
): Replacement | null {
  const converted = createListNode(state.schema, target.list, style);
  if (!converted) return null;

  let itemOffset = 1;
  for (let index = 0; index < target.itemIndex; index += 1) itemOffset += converted.child(index).nodeSize;

  return {
    content: Fragment.from(converted),
    from: target.listPosition,
    selectionOffset: itemOffset,
    to: target.listPosition + target.list.nodeSize
  };
}

function createBlockReplacement(state: EditorState, source: ProseMirrorNode, style: MarkdownBlockStyle): Fragment | null {
  const textblocks = collectTextblocks(source);
  if (textblocks.length === 0) return null;

  if (style === "paragraph") {
    const paragraph = state.schema.nodes.paragraph;
    if (!paragraph) return null;
    return Fragment.fromArray(textblocks.map((node) => paragraph.create(null, node.content)));
  }

  if (style.startsWith("heading-")) {
    const heading = state.schema.nodes.heading;
    if (!heading) return null;
    const level = Number(style.slice("heading-".length));
    return Fragment.fromArray(textblocks.map((node) => heading.create({ level }, node.content)));
  }

  if (style === "code-block") {
    const codeBlock = state.schema.nodes.code_block;
    if (!codeBlock) return null;
    return Fragment.fromArray(
      textblocks.map((node) => codeBlock.create(null, node.textContent ? state.schema.text(node.textContent) : undefined))
    );
  }

  if (style === "blockquote") {
    const blockquote = state.schema.nodes.blockquote;
    const paragraph = state.schema.nodes.paragraph;
    if (!blockquote || !paragraph) return null;
    const paragraphs = textblocks.map((node) => paragraph.create(null, node.content));
    return Fragment.from(blockquote.create(null, Fragment.fromArray(paragraphs)));
  }

  if (isListStyle(style)) return createListFromTextblocks(state.schema, source, textblocks, style);
  return null;
}

function createSingleBlockStyle(
  schema: Schema,
  leadingBlock: ProseMirrorNode,
  tail: ProseMirrorNode[],
  style: Exclude<MarkdownBlockStyle, "bullet-list" | "ordered-list" | "task-list">
) {
  if (style === "paragraph") {
    const paragraph = schema.nodes.paragraph;
    return paragraph ? [paragraph.create(null, leadingBlock.content), ...tail] : null;
  }

  if (style.startsWith("heading-")) {
    const heading = schema.nodes.heading;
    const level = Number(style.slice("heading-".length));
    return heading ? [heading.create({ level }, leadingBlock.content), ...tail] : null;
  }

  if (style === "code-block") {
    const codeBlock = schema.nodes.code_block;
    if (!codeBlock) return null;
    const text = leadingBlock.textContent ? schema.text(leadingBlock.textContent) : undefined;
    return [codeBlock.create(null, text), ...tail];
  }

  const paragraph = schema.nodes.paragraph;
  const blockquote = schema.nodes.blockquote;
  if (!paragraph || !blockquote) return null;
  return [blockquote.create(null, Fragment.fromArray([paragraph.create(null, leadingBlock.content), ...tail]))];
}

function createListFromTextblocks(
  schema: Schema,
  source: ProseMirrorNode,
  textblocks: ProseMirrorNode[],
  style: Extract<MarkdownBlockStyle, "bullet-list" | "ordered-list" | "task-list">
): Fragment | null {
  const paragraph = schema.nodes.paragraph;
  const listItem = schema.nodes.list_item;
  if (!paragraph || !listItem) return null;

  const sourceItems = isListNode(source) ? childrenBetween(source, 0, source.childCount) : null;
  const items = sourceItems
    ? sourceItems.map((item, index) => listItem.create(updateListItemAttrs(listItem, item.attrs, style, index), item.content))
    : textblocks.map((node, index) => {
        const content = Fragment.from(paragraph.create(null, node.content));
        return listItem.create(updateListItemAttrs(listItem, {}, style, index), content);
      });
  const list = createListNodeFromItems(schema, source, items, style);
  return list ? Fragment.from(list) : null;
}

function createListNode(
  schema: Schema,
  source: ProseMirrorNode,
  style: Extract<MarkdownBlockStyle, "bullet-list" | "ordered-list" | "task-list">
) {
  const listItem = schema.nodes.list_item;
  if (!listItem) return null;
  const items = childrenBetween(source, 0, source.childCount).map((item, index) =>
    listItem.create(updateListItemAttrs(listItem, item.attrs, style, index), item.content)
  );
  return createListNodeFromItems(schema, source, items, style);
}

function createListNodeFromItems(
  schema: Schema,
  source: ProseMirrorNode,
  items: ProseMirrorNode[],
  style: Extract<MarkdownBlockStyle, "bullet-list" | "ordered-list" | "task-list">
) {
  const isOrdered = style === "ordered-list";
  const list = isOrdered ? schema.nodes.ordered_list : schema.nodes.bullet_list;
  if (!list) return null;

  const attrs: Record<string, unknown> = {};
  for (const key of Object.keys(list.spec.attrs ?? {})) {
    if (key === "order" && isOrdered) attrs[key] = source.type.name === "ordered_list" ? source.attrs.order : 1;
    else if (Object.hasOwn(source.attrs, key)) attrs[key] = source.attrs[key];
  }
  return list.create(attrs, Fragment.fromArray(items));
}

function updateListItemAttrs(
  listItem: NodeType,
  currentAttrs: ProseMirrorNode["attrs"],
  style: Extract<MarkdownBlockStyle, "bullet-list" | "ordered-list" | "task-list">,
  index: number
) {
  const attrs = { ...currentAttrs };
  const isOrdered = style === "ordered-list";
  const attrSpec = listItem.spec.attrs ?? {};
  if (Object.hasOwn(attrSpec, "checked")) attrs.checked = style === "task-list" ? currentAttrs.checked ?? false : null;
  if (Object.hasOwn(attrSpec, "listType")) attrs.listType = isOrdered ? "ordered" : "bullet";
  if (Object.hasOwn(attrSpec, "label")) attrs.label = isOrdered ? `${index + 1}.` : "•";
  return attrs;
}

function createListSegment(source: ProseMirrorNode, items: ProseMirrorNode[], itemOffset = 0) {
  if (items.length === 0) return null;

  const attrs = source.type.name === "ordered_list"
    ? { ...source.attrs, order: Number(source.attrs.order ?? 1) + itemOffset }
    : source.attrs;
  return source.type.create(attrs, Fragment.fromArray(items));
}

function childrenBetween(node: ProseMirrorNode, from: number, to: number) {
  return Array.from({ length: Math.max(0, to - from) }, (_, index) => node.child(from + index));
}

function collectTextblocks(node: ProseMirrorNode) {
  if (node.isTextblock) return [node];
  const textblocks: ProseMirrorNode[] = [];
  node.descendants((child) => {
    if (!child.isTextblock) return true;
    textblocks.push(child);
    return false;
  });
  return textblocks;
}

function getListItemStyle(target: ListItemTarget): MarkdownBlockStyle {
  if (target.item.attrs.checked != null) return "task-list";
  return target.list.type.name === "ordered_list" ? "ordered-list" : "bullet-list";
}

function getNodeStyle(node: ProseMirrorNode): MarkdownBlockStyle | null {
  if (node.type.name === "paragraph") return "paragraph";
  if (node.type.name === "heading") {
    const level = Number(node.attrs.level);
    return level >= 1 && level <= 6 ? (`heading-${level}` as MarkdownBlockStyle) : null;
  }
  if (node.type.name === "ordered_list") return hasTaskItems(node) ? "task-list" : "ordered-list";
  if (node.type.name === "bullet_list") return hasTaskItems(node) ? "task-list" : "bullet-list";
  if (node.type.name === "blockquote") return "blockquote";
  if (node.type.name === "code_block") return "code-block";
  return null;
}

function listAlreadyMatchesStyle(
  list: ProseMirrorNode,
  style: Extract<MarkdownBlockStyle, "bullet-list" | "ordered-list" | "task-list">
) {
  const items = childrenBetween(list, 0, list.childCount);
  if (style === "ordered-list") return list.type.name === "ordered_list" && items.every((item) => item.attrs.checked == null);
  if (style === "bullet-list") return list.type.name === "bullet_list" && items.every((item) => item.attrs.checked == null);
  return list.type.name === "bullet_list" && items.every((item) => item.attrs.checked != null);
}

function hasTaskItems(node: ProseMirrorNode) {
  return childrenBetween(node, 0, node.childCount).some(
    (child) => child.type.name === "list_item" && child.attrs.checked != null
  );
}

function isListNode(node: ProseMirrorNode) {
  return node.type.name === "bullet_list" || node.type.name === "ordered_list";
}

function isListStyle(
  style: MarkdownBlockStyle
): style is Extract<MarkdownBlockStyle, "bullet-list" | "ordered-list" | "task-list"> {
  return listStyles.has(style);
}
