import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

import {
  MARKDOWN_FOLD_SNAPSHOT_VERSION,
  normalizeMarkdownFoldSnapshot,
  type MarkdownFoldAnchor,
  type MarkdownFoldSnapshot,
  type MarkdownHeadingFoldSegment,
  type MarkdownListFoldSegment
} from "@/features/mermaid-editor/lib/markdown-fold-state";

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
} | {
  collapsedHeadings: number[];
  collapsedListItems: number[];
  type: "restore";
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

export function readMarkdownFoldSnapshot(state: EditorState): MarkdownFoldSnapshot {
  const foldingState = markdownFoldingProsePluginKey.getState(state);
  const anchors = collectFoldAnchors(state.doc);
  const folds: MarkdownFoldAnchor[] = [];

  for (const position of foldingState?.collapsedHeadings ?? []) {
    const anchor = anchors.headingByPosition.get(position);
    if (anchor) folds.push(anchor);
  }
  for (const position of foldingState?.collapsedListItems ?? []) {
    const anchor = anchors.listByPosition.get(position);
    if (anchor) folds.push(anchor);
  }

  return {
    version: MARKDOWN_FOLD_SNAPSHOT_VERSION,
    documentFingerprint: markdownDocumentFingerprint(state.doc),
    folds
  };
}

export function restoreMarkdownFoldSnapshot(view: EditorView, value: unknown) {
  const snapshot = normalizeMarkdownFoldSnapshot(value);
  if (!snapshot) return false;

  const resolved = resolveFoldSnapshot(view.state.doc, snapshot);
  view.dispatch(view.state.tr.setMeta(markdownFoldingProsePluginKey, {
    collapsedHeadings: resolved.headings,
    collapsedListItems: resolved.listItems,
    type: "restore"
  } satisfies MarkdownFoldAction));
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

  if (action?.type === "restore") {
    return createFoldingState(
      newState.doc,
      new Set(action.collapsedHeadings),
      new Set(action.collapsedListItems)
    );
  }

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

type FoldAnchorCollection = {
  headingByPosition: Map<number, Extract<MarkdownFoldAnchor, { kind: "heading" }>>;
  listByPosition: Map<number, Extract<MarkdownFoldAnchor, { kind: "list-item" }>>;
};

function collectFoldAnchors(doc: ProseMirrorNode): FoldAnchorCollection {
  const headingTargets = collectHeadingFoldTargets(doc);
  const headingByPosition = collectHeadingAnchors(headingTargets);
  const rootListPositions = collectRootListPositions(doc);
  const listByPosition = new Map<number, Extract<MarkdownFoldAnchor, { kind: "list-item" }>>();

  for (const target of collectListFoldTargets(doc)) {
    const path = listItemPath(doc, target.position);
    if (!path.length) continue;
    const rootPosition = rootListPosition(doc, target.position);
    const section = headingSectionAtPosition(headingTargets, headingByPosition, rootPosition);
    const sectionKey = semanticHeadingKey(section);
    const rootsInSection = rootListPositions.filter((position) =>
      semanticHeadingKey(headingSectionAtPosition(headingTargets, headingByPosition, position)) === sectionKey
    );
    const rootOccurrence = Math.max(0, rootsInSection.indexOf(rootPosition));
    listByPosition.set(target.position, {
      kind: "list-item",
      section,
      rootOccurrence,
      path
    });
  }

  return { headingByPosition, listByPosition };
}

function collectHeadingAnchors(targets: HeadingFoldTarget[]) {
  const result = new Map<number, Extract<MarkdownFoldAnchor, { kind: "heading" }>>();
  const stack: Array<{ level: number; outline: MarkdownHeadingFoldSegment[] }> = [];
  const occurrences = new Map<string, number>();

  for (const target of targets) {
    while (stack.length && stack[stack.length - 1]!.level >= target.level) stack.pop();
    const parent = stack.at(-1)?.outline ?? [];
    const label = normalizeFoldLabel(target.label);
    const occurrenceKey = `${exactHeadingKey(parent)}\u0000${target.level}\u0000${label}`;
    const occurrence = occurrences.get(occurrenceKey) ?? 0;
    occurrences.set(occurrenceKey, occurrence + 1);
    const outline = [...parent, { level: target.level, label, occurrence }];
    result.set(target.position, { kind: "heading", outline });
    stack.push({ level: target.level, outline });
  }

  return result;
}

function headingSectionAtPosition(
  targets: HeadingFoldTarget[],
  anchors: Map<number, Extract<MarkdownFoldAnchor, { kind: "heading" }>>,
  position: number
) {
  let section: MarkdownHeadingFoldSegment[] = [];
  for (const target of targets) {
    if (target.contentFrom > position || target.contentTo <= position) continue;
    section = anchors.get(target.position)?.outline ?? section;
  }
  return section;
}

function listItemPath(doc: ProseMirrorNode, position: number): MarkdownListFoldSegment[] {
  const $position = doc.resolve(position);
  const itemPositions: number[] = [];
  for (let depth = 1; depth <= $position.depth; depth += 1) {
    if ($position.node(depth).type.name === "list_item") itemPositions.push($position.before(depth));
  }
  if (doc.nodeAt(position)?.type.name === "list_item") itemPositions.push(position);

  return itemPositions.map((itemPosition) => {
    const $item = doc.resolve(itemPosition);
    const item = doc.nodeAt(itemPosition)!;
    const label = normalizeFoldLabel(item.firstChild?.textContent ?? item.textContent);
    let occurrence = 0;
    const itemIndex = $item.index();
    for (let index = 0; index < itemIndex; index += 1) {
      const sibling = $item.parent.child(index);
      const siblingLabel = normalizeFoldLabel(sibling.firstChild?.textContent ?? sibling.textContent);
      if (sibling.type.name === "list_item" && siblingLabel === label) occurrence += 1;
    }
    return { label, occurrence };
  });
}

function rootListPosition(doc: ProseMirrorNode, itemPosition: number) {
  const $position = doc.resolve(itemPosition);
  for (let depth = 1; depth <= $position.depth; depth += 1) {
    if (isListNode($position.node(depth))) return $position.before(depth);
  }
  return itemPosition;
}

function collectRootListPositions(doc: ProseMirrorNode) {
  const positions: number[] = [];
  doc.descendants((node, position) => {
    if (!isListNode(node)) return true;
    const $position = doc.resolve(position);
    const nested = Array.from({ length: $position.depth }, (_, index) => index + 1)
      .some((depth) => $position.node(depth).type.name === "list_item");
    if (!nested) positions.push(position);
    return true;
  });
  return positions;
}

function resolveFoldSnapshot(doc: ProseMirrorNode, snapshot: MarkdownFoldSnapshot) {
  const anchors = collectFoldAnchors(doc);
  const exactDocument = snapshot.documentFingerprint === markdownDocumentFingerprint(doc);
  const headings: number[] = [];
  const listItems: number[] = [];

  for (const fold of snapshot.folds) {
    const candidates = fold.kind === "heading"
      ? [...anchors.headingByPosition.entries()]
      : [...anchors.listByPosition.entries()];
    const matches = candidates.filter(([, candidate]) => exactDocument
      ? exactFoldAnchorKey(candidate) === exactFoldAnchorKey(fold)
      : semanticFoldAnchorKey(candidate) === semanticFoldAnchorKey(fold));
    if (matches.length !== 1) continue;
    if (fold.kind === "heading") headings.push(matches[0]![0]);
    else listItems.push(matches[0]![0]);
  }

  return {
    headings: [...new Set(headings)],
    listItems: [...new Set(listItems)]
  };
}

export function markdownDocumentFingerprint(doc: ProseMirrorNode) {
  const serialized = JSON.stringify(doc.toJSON());
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}:${serialized.length.toString(36)}`;
}

function exactFoldAnchorKey(anchor: MarkdownFoldAnchor) {
  return JSON.stringify(anchor);
}

function semanticFoldAnchorKey(anchor: MarkdownFoldAnchor) {
  return anchor.kind === "heading"
    ? `heading:${semanticHeadingKey(anchor.outline)}`
    : `list:${semanticHeadingKey(anchor.section)}:${anchor.path.map((segment) => segment.label).join("\u0000")}`;
}

function exactHeadingKey(outline: MarkdownHeadingFoldSegment[]) {
  return outline.map((segment) => `${segment.level}:${segment.label}:${segment.occurrence}`).join("\u0001");
}

function semanticHeadingKey(outline: MarkdownHeadingFoldSegment[]) {
  return outline.map((segment) => `${segment.level}:${segment.label}`).join("\u0001");
}

function normalizeFoldLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 256);
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
