import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export type MarkdownFoldKind = "heading" | "list-item";

export type MarkdownFoldTarget = {
  collapsed: boolean;
  kind: MarkdownFoldKind;
  label: string;
  position: number;
};

type MarkdownFoldAction = {
  kind: MarkdownFoldKind;
  position: number;
  type: "toggle";
};

type HeadingFoldTarget = {
  contentFrom: number;
  contentTo: number;
  label: string;
  level: number;
  node: ProseMirrorNode;
  position: number;
};

type ListFoldTarget = {
  label: string;
  nestedRanges: ReadonlyArray<{ from: number; to: number }>;
  node: ProseMirrorNode;
  position: number;
};

export type MarkdownFoldingState = {
  collapsedHeadings: ReadonlySet<number>;
  collapsedListItems: ReadonlySet<number>;
  decorations: DecorationSet;
};

export const markdownFoldingProsePluginKey = new PluginKey<MarkdownFoldingState>("markdown-hierarchy-folding");

export function createMarkdownFoldingProsePlugin() {
  return new Plugin<MarkdownFoldingState>({
    key: markdownFoldingProsePluginKey,
    state: {
      init: (_config, state) => createFoldingState(state.doc, new Set(), new Set()),
      apply(transaction, previous, _oldState, newState) {
        return applyFoldingTransaction(transaction, previous, newState);
      }
    },
    props: {
      decorations(state) {
        return markdownFoldingProsePluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      }
    }
  });
}

export const markdownFolding = $prose(() => createMarkdownFoldingProsePlugin());

export function collectHeadingFoldTargets(doc: ProseMirrorNode): HeadingFoldTarget[] {
  const headings: Array<Omit<HeadingFoldTarget, "contentTo">> = [];

  doc.forEach((node, position) => {
    if (node.type.name !== "heading") return;
    headings.push({
      contentFrom: position + node.nodeSize,
      label: node.textContent,
      level: getHeadingLevel(node),
      node,
      position
    });
  });

  return headings.flatMap((heading, index) => {
    const nextBoundary = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    const contentTo = nextBoundary?.position ?? doc.content.size;
    if (heading.contentFrom >= contentTo) return [];
    return [{ ...heading, contentTo }];
  });
}

export function collectListFoldTargets(doc: ProseMirrorNode): ListFoldTarget[] {
  const targets: ListFoldTarget[] = [];

  doc.descendants((node, position) => {
    if (node.type.name !== "list_item") return true;

    const nestedRanges: Array<{ from: number; to: number }> = [];
    node.forEach((child, offset) => {
      if (!isListNode(child)) return;
      const from = position + 1 + offset;
      nestedRanges.push({ from, to: from + child.nodeSize });
    });

    if (nestedRanges.length > 0) {
      targets.push({
        label: node.firstChild?.textContent ?? node.textContent,
        nestedRanges,
        node,
        position
      });
    }

    return true;
  });

  return targets;
}

export function findMarkdownFoldTarget(state: EditorState, position: number): MarkdownFoldTarget | null {
  const headingTargets = collectHeadingFoldTargets(state.doc);
  const listTargets = collectListFoldTargets(state.doc);
  const foldingState = markdownFoldingProsePluginKey.getState(state);
  const maxPosition = state.doc.content.size;
  const clamped = Math.max(0, Math.min(position, maxPosition));
  const probes = [clamped, clamped + 1, clamped - 1]
    .filter((probe, index, values) => probe >= 0 && probe <= maxPosition && values.indexOf(probe) === index);

  for (const probe of probes) {
    const $pos = state.doc.resolve(probe);
    const nodeAfter = $pos.nodeAfter;
    if (nodeAfter?.type.name === "heading") {
      const target = headingTargets.find((candidate) => candidate.position === probe);
      if (target) return toPublicTarget(target, "heading", foldingState?.collapsedHeadings);
    }
    if (nodeAfter?.type.name === "list_item") {
      const target = listTargets.find((candidate) => candidate.position === probe);
      return target ? toPublicTarget(target, "list-item", foldingState?.collapsedListItems) : null;
    }

    for (let depth = $pos.depth; depth >= 1; depth -= 1) {
      const node = $pos.node(depth);
      const nodePosition = $pos.before(depth);
      if (node.type.name === "list_item") {
        const target = listTargets.find((candidate) => candidate.position === nodePosition);
        return target ? toPublicTarget(target, "list-item", foldingState?.collapsedListItems) : null;
      }
      if (node.type.name === "heading") {
        const target = headingTargets.find((candidate) => candidate.position === nodePosition);
        if (target) return toPublicTarget(target, "heading", foldingState?.collapsedHeadings);
      }
    }
  }

  return null;
}

export function toggleMarkdownFold(view: EditorView, target: Pick<MarkdownFoldTarget, "kind" | "position">) {
  const currentTarget = findMarkdownFoldTarget(view.state, target.position);
  if (!currentTarget || currentTarget.kind !== target.kind || currentTarget.position !== target.position) return false;

  const willCollapse = !currentTarget.collapsed;
  let transaction = view.state.tr;

  if (willCollapse && selectionWillBeHidden(view.state, target.kind, target.position)) {
    const selectionPosition = Math.min(target.position + 1, view.state.doc.content.size);
    transaction = transaction.setSelection(TextSelection.near(view.state.doc.resolve(selectionPosition), 1));
  }

  transaction = transaction.setMeta(markdownFoldingProsePluginKey, {
    kind: target.kind,
    position: target.position,
    type: "toggle"
  } satisfies MarkdownFoldAction);
  view.dispatch(transaction);
  view.focus();
  return true;
}

function applyFoldingTransaction(
  transaction: Transaction,
  previous: MarkdownFoldingState,
  newState: EditorState
): MarkdownFoldingState {
  const action = transaction.getMeta(markdownFoldingProsePluginKey) as MarkdownFoldAction | undefined;
  if (!transaction.docChanged && !action) return previous;

  const collapsedHeadings = transaction.docChanged
    ? mapFoldPositions(previous.collapsedHeadings, transaction, newState.doc, "heading")
    : new Set(previous.collapsedHeadings);
  const collapsedListItems = transaction.docChanged
    ? mapFoldPositions(previous.collapsedListItems, transaction, newState.doc, "list-item")
    : new Set(previous.collapsedListItems);

  if (action?.type === "toggle") {
    const targetSet = action.kind === "heading" ? collapsedHeadings : collapsedListItems;
    if (targetSet.has(action.position)) targetSet.delete(action.position);
    else targetSet.add(action.position);
  }

  return createFoldingState(newState.doc, collapsedHeadings, collapsedListItems);
}

function createFoldingState(
  doc: ProseMirrorNode,
  requestedHeadings: ReadonlySet<number>,
  requestedListItems: ReadonlySet<number>
): MarkdownFoldingState {
  const headingTargets = collectHeadingFoldTargets(doc);
  const listTargets = collectListFoldTargets(doc);
  const validHeadingPositions = new Set(headingTargets.map((target) => target.position));
  const validListPositions = new Set(listTargets.map((target) => target.position));
  const collapsedHeadings = intersectPositions(requestedHeadings, validHeadingPositions);
  const collapsedListItems = intersectPositions(requestedListItems, validListPositions);

  return {
    collapsedHeadings,
    collapsedListItems,
    decorations: buildFoldDecorations(doc, headingTargets, listTargets, collapsedHeadings, collapsedListItems)
  };
}

function buildFoldDecorations(
  doc: ProseMirrorNode,
  headingTargets: ReadonlyArray<HeadingFoldTarget>,
  listTargets: ReadonlyArray<ListFoldTarget>,
  collapsedHeadings: ReadonlySet<number>,
  collapsedListItems: ReadonlySet<number>
) {
  const decorations: Decoration[] = [];
  const hiddenTopLevelPositions = new Set<number>();

  for (const target of headingTargets) {
    const collapsed = collapsedHeadings.has(target.position);
    if (!collapsed) continue;
    decorations.push(
      Decoration.node(target.position, target.position + target.node.nodeSize, {
        class: "markdown-fold-heading--collapsed",
        "data-markdown-fold-level": String(target.level)
      })
    );
    doc.forEach((node, position) => {
      if (position >= target.contentFrom && position < target.contentTo) {
        hiddenTopLevelPositions.add(position);
      }
    });
  }

  for (const position of hiddenTopLevelPositions) {
    const node = doc.nodeAt(position);
    if (!node) continue;
    decorations.push(
      Decoration.node(position, position + node.nodeSize, {
        "aria-hidden": "true",
        class: "markdown-fold-hidden"
      })
    );
  }

  for (const target of listTargets) {
    const collapsed = collapsedListItems.has(target.position);
    decorations.push(
      Decoration.node(target.position, target.position + target.node.nodeSize, {
        class: collapsed
          ? "markdown-fold-list-parent markdown-fold-list-parent--collapsed"
          : "markdown-fold-list-parent"
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

function selectionWillBeHidden(state: EditorState, kind: MarkdownFoldKind, position: number) {
  const { from, to } = state.selection;

  if (kind === "heading") {
    const target = collectHeadingFoldTargets(state.doc).find((candidate) => candidate.position === position);
    return Boolean(target && rangesOverlap(from, to, target.contentFrom, target.contentTo));
  }

  const target = collectListFoldTargets(state.doc).find((candidate) => candidate.position === position);
  return Boolean(target?.nestedRanges.some((range) => rangesOverlap(from, to, range.from, range.to)));
}

function rangesOverlap(selectionFrom: number, selectionTo: number, hiddenFrom: number, hiddenTo: number) {
  if (selectionFrom === selectionTo) return selectionFrom >= hiddenFrom && selectionFrom < hiddenTo;
  return selectionFrom < hiddenTo && selectionTo > hiddenFrom;
}

function mapFoldPositions(
  positions: ReadonlySet<number>,
  transaction: Transaction,
  doc: ProseMirrorNode,
  kind: MarkdownFoldKind
) {
  const mapped = new Set<number>();
  for (const position of positions) {
    const result = transaction.mapping.mapResult(position, 1);
    if (result.deleted) continue;
    const node = doc.nodeAt(result.pos);
    if (node && matchesFoldKind(node, kind)) mapped.add(result.pos);
  }
  return mapped;
}

function matchesFoldKind(node: ProseMirrorNode, kind: MarkdownFoldKind) {
  return kind === "heading" ? node.type.name === "heading" : node.type.name === "list_item";
}

function intersectPositions(requested: ReadonlySet<number>, valid: ReadonlySet<number>) {
  return new Set([...requested].filter((position) => valid.has(position)));
}

function getHeadingLevel(node: ProseMirrorNode) {
  const level = Number(node.attrs.level);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;
}

function isListNode(node: ProseMirrorNode) {
  return node.type.name === "bullet_list" || node.type.name === "ordered_list";
}

function toPublicTarget(
  target: Pick<HeadingFoldTarget | ListFoldTarget, "label" | "position">,
  kind: MarkdownFoldKind,
  collapsedPositions: ReadonlySet<number> | undefined
): MarkdownFoldTarget {
  return {
    collapsed: collapsedPositions?.has(target.position) ?? false,
    kind,
    label: target.label,
    position: target.position
  };
}
