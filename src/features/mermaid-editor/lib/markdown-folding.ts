import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export type MarkdownFoldKind = "heading" | "list-item";

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
      },
      handleDOMEvents: {
        mousedown(_view, event) {
          if (!getFoldButton(event.target)) return false;
          event.preventDefault();
          return true;
        },
        click(view, event) {
          const button = getFoldButton(event.target);
          if (!button) return false;

          const kind = button.dataset.markdownFoldKind;
          const position = Number(button.dataset.markdownFoldPosition);
          if ((kind !== "heading" && kind !== "list-item") || !Number.isInteger(position)) return false;

          event.preventDefault();
          toggleMarkdownFold(view, kind, position);
          return true;
        }
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
    decorations.push(
      Decoration.node(target.position, target.position + target.node.nodeSize, {
        class: collapsed
          ? "markdown-fold-heading markdown-fold-heading--collapsed"
          : "markdown-fold-heading",
        "data-markdown-fold-level": String(target.level)
      }),
      Decoration.widget(
        target.position + 1,
        () => createFoldButton("heading", target.position, target.label, collapsed),
        { side: -1 }
      )
    );

    if (!collapsed) continue;
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
      }),
      Decoration.widget(
        target.position + 1,
        () => createFoldButton("list-item", target.position, target.label, collapsed),
        { side: -1 }
      )
    );
  }

  return DecorationSet.create(doc, decorations);
}

function createFoldButton(kind: MarkdownFoldKind, position: number, label: string, collapsed: boolean) {
  const button = document.createElement("button");
  const subject = kind === "heading" ? "章节" : "子列表";
  const action = collapsed ? "展开" : "折叠";
  const normalizedLabel = label.trim().replace(/\s+/g, " ").slice(0, 48);
  const accessibleLabel = normalizedLabel ? `${action}${subject}“${normalizedLabel}”` : `${action}${subject}`;

  button.type = "button";
  button.className = `markdown-fold-toggle markdown-fold-toggle--${kind}`;
  button.contentEditable = "false";
  button.dataset.markdownFoldKind = kind;
  button.dataset.markdownFoldPosition = String(position);
  button.setAttribute("aria-expanded", collapsed ? "false" : "true");
  button.setAttribute("aria-label", accessibleLabel);
  button.title = `${action}${subject}`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("viewBox", "0 0 24 24");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M9 6l6 6-6 6");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-width", "1.5");
  svg.appendChild(path);
  button.appendChild(svg);

  return button;
}

function toggleMarkdownFold(view: EditorView, kind: MarkdownFoldKind, position: number) {
  const foldingState = markdownFoldingProsePluginKey.getState(view.state);
  if (!foldingState) return;

  const collapsedPositions = kind === "heading"
    ? foldingState.collapsedHeadings
    : foldingState.collapsedListItems;
  const willCollapse = !collapsedPositions.has(position);
  let transaction = view.state.tr;

  if (willCollapse && selectionWillBeHidden(view.state, kind, position)) {
    const selectionPosition = Math.min(position + 1, view.state.doc.content.size);
    transaction = transaction.setSelection(TextSelection.near(view.state.doc.resolve(selectionPosition), 1));
  }

  transaction = transaction.setMeta(markdownFoldingProsePluginKey, {
    kind,
    position,
    type: "toggle"
  } satisfies MarkdownFoldAction);
  view.dispatch(transaction);
  view.focus();
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

function getFoldButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const button = target.closest<HTMLButtonElement>("button.markdown-fold-toggle");
  return button?.isConnected ? button : null;
}

function getHeadingLevel(node: ProseMirrorNode) {
  const level = Number(node.attrs.level);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;
}

function isListNode(node: ProseMirrorNode) {
  return node.type.name === "bullet_list" || node.type.name === "ordered_list";
}
