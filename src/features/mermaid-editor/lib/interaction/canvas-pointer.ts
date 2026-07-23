import {
  dispatchCanvasClick,
  dispatchCanvasDoubleClick,
  dispatchCanvasPointerDown,
  dispatchCanvasPointerMove,
  dispatchCanvasPointerUp,
  hasSelection,
  type BlankClickIntent,
  type CanvasInteractionCommand,
  type CanvasPoint,
  type CanvasRect,
  type InlineEditCommandTarget,
  type InteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction";
import {
  emptySelection,
  selectOnlyEdge,
  selectOnlyNode,
  selectOnlySubgraph,
  toggleEdgeSelection,
  toggleNodeSelection,
  toggleSubgraphSelection
} from "@/features/mermaid-editor/lib/editor-actions";
import type { InteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { StandardPointerInput } from "@/features/mermaid-editor/lib/interaction/input";
import { isMarkdownDocumentNode } from "@/features/mermaid-editor/lib/markdown-document";
import { isHtmlDocumentNode } from "@/features/mermaid-editor/lib/html-document";

export type CanvasPointerLocalEffect =
  | { type: "blankClick.invalidate" }
  | { type: "blankClick.record"; intent: BlankClickIntent }
  | { type: "interaction.reset" }
  | { type: "inlineEdit.start"; target: InlineEditCommandTarget }
  | { type: "nodeAction.open"; nodeId: string }
  | { type: "drag.startNode"; nodeId: string }
  | { type: "drag.startSubgraph"; subgraphId: string }
  | { type: "graph.resolveAddNodeAt"; point: CanvasPoint }
  | { type: "selection.resolveMarquee"; rect: CanvasRect }
  | { type: "edge.resolveConnection"; draft: Extract<InteractionState, { kind: "connectingEdge" }> }
  | { type: "edge.resolveRetarget"; edgeId: string; side: "from" | "to"; point: CanvasPoint };

export type CanvasPointerResolution = {
  state?: InteractionState;
  editorCommands: EditorCommand[];
  localEffects: CanvasPointerLocalEffect[];
};

export type ResolveCanvasPointerOptions = {
  state: InteractionState;
  selectionVersion: number;
  panningRequested?: boolean;
  dragEnabled?: boolean;
  previousBlankClick?: BlankClickIntent | null;
  interactionGeneration?: number;
  now?: number;
};

export function resolveCanvasPointerDown(
  input: StandardPointerInput,
  context: InteractionContext,
  options: ResolveCanvasPointerOptions
): CanvasPointerResolution {
  if (!input.world) return emptyResolution(options.state);

  const result = dispatchCanvasPointerDown({
    state: options.state,
    tool: context.mode,
    hit: input.hit,
    button: input.button,
    screen: input.screen,
    world: input.world,
    now: input.timestamp || options.now || 0,
    selectionVersion: options.selectionVersion,
    viewport: context.viewport,
    panningRequested: options.panningRequested
  });

  return {
    ...commandsToPointerResolution(result.commands, context),
    state: !options.dragEnabled && isPendingDragState(result.state) ? { kind: "idle" } : result.state
  };
}

export function resolveCanvasPointerMove(
  input: StandardPointerInput,
  context: InteractionContext,
  options: ResolveCanvasPointerOptions
): CanvasPointerResolution {
  if (!input.world) return emptyResolution(options.state);

  const result = dispatchCanvasPointerMove({
    state: options.state,
    screen: input.screen,
    world: input.world
  });

  return {
    ...commandsToPointerResolution(result.commands, context),
    state: result.state
  };
}

export function resolveCanvasPointerUp(
  input: StandardPointerInput,
  context: InteractionContext,
  options: ResolveCanvasPointerOptions
): CanvasPointerResolution {
  if (!input.world) return { state: { kind: "idle" }, editorCommands: [], localEffects: [{ type: "interaction.reset" }] };

  const result = dispatchCanvasPointerUp({
    state: options.state,
    tool: context.mode,
    hit: input.hit,
    hasSelection: hasSelection(context.selection),
    screen: input.screen,
    world: input.world,
    now: options.now || input.timestamp || 0,
    previousBlankClick: options.previousBlankClick || null,
    selectionVersion: options.selectionVersion,
    interactionGeneration: options.interactionGeneration || 0
  });

  return {
    ...commandsToPointerResolution(result.commands, context),
    state: result.state
  };
}

export function resolveCanvasPointerClick(input: StandardPointerInput, context: InteractionContext): CanvasPointerResolution {
  return commandsToPointerResolution(
    dispatchCanvasClick({
      tool: context.mode,
      hit: input.hit,
      shiftKey: input.modifiers.shiftKey
    }),
    context
  );
}

export function resolveCanvasPointerDoubleClick(input: StandardPointerInput, context: InteractionContext): CanvasPointerResolution {
  return commandsToPointerResolution(
    dispatchCanvasDoubleClick({
      tool: context.mode,
      hit: input.hit
    }),
    context
  );
}

export function commandsToPointerResolution(commands: CanvasInteractionCommand[], context: InteractionContext): CanvasPointerResolution {
  const editorCommands: EditorCommand[] = [];
  const localEffects: CanvasPointerLocalEffect[] = [];

  for (const command of commands) {
    if (command.type === "invalidateBlankClick") {
      localEffects.push({ type: "blankClick.invalidate" });
      continue;
    }

    if (command.type === "clearSelection") {
      editorCommands.push({ type: "selection.clear", source: "pointer" });
      continue;
    }

    if (command.type === "recordBlankClick") {
      localEffects.push({ type: "blankClick.record", intent: command.intent });
      continue;
    }

    if (command.type === "addNodeAt") {
      localEffects.push({ type: "graph.resolveAddNodeAt", point: command.point });
      continue;
    }

    if (command.type === "selectNode") {
      editorCommands.push({
        type: "selection.set",
        selection: command.additive ? toggleNodeSelection(context.selection, command.id) : selectOnlyNode(command.id),
        source: "pointer"
      });
      continue;
    }

    if (command.type === "selectSubgraph") {
      editorCommands.push({
        type: "selection.set",
        selection: command.additive ? toggleSubgraphSelection(context.selection, command.id) : selectOnlySubgraph(command.id),
        source: "pointer"
      });
      continue;
    }

    if (command.type === "selectEdge") {
      editorCommands.push({
        type: "selection.set",
        selection: command.additive ? toggleEdgeSelection(context.selection, command.id) : selectOnlyEdge(command.id),
        source: "pointer"
      });
      continue;
    }

    if (command.type === "startInlineEdit") {
      if (command.target.type === "node") {
        const node = context.graph.nodes.find((item) => item.id === command.target.id);
        if (node && (isMarkdownDocumentNode(node) || isHtmlDocumentNode(node))) {
          localEffects.push({ type: "nodeAction.open", nodeId: node.id });
          continue;
        }
      }
      localEffects.push({ type: "inlineEdit.start", target: command.target });
      continue;
    }

    if (command.type === "startNodeDrag") {
      localEffects.push({ type: "drag.startNode", nodeId: command.nodeId });
      continue;
    }

    if (command.type === "startSubgraphDrag") {
      localEffects.push({ type: "drag.startSubgraph", subgraphId: command.subgraphId });
      continue;
    }

    if (command.type === "selectMarquee") {
      if (command.rect.width > 4 || command.rect.height > 4) {
        localEffects.push({ type: "selection.resolveMarquee", rect: command.rect });
      } else {
        editorCommands.push({ type: "selection.set", selection: emptySelection, source: "pointer" });
      }
      continue;
    }

    if (command.type === "finishConnection") {
      localEffects.push({ type: "edge.resolveConnection", draft: command.draft });
      continue;
    }

    if (command.type === "retargetEdge") {
      localEffects.push({ type: "edge.resolveRetarget", edgeId: command.edgeId, side: command.side, point: command.point });
      continue;
    }

    if (command.type === "resetInteraction") {
      localEffects.push({ type: "interaction.reset" });
    }
  }

  return { editorCommands, localEffects };
}

function emptyResolution(state: InteractionState): CanvasPointerResolution {
  return { state, editorCommands: [], localEffects: [] };
}

function isPendingDragState(state: InteractionState) {
  return state.kind === "pendingNodePointer" || state.kind === "pendingSubgraphPointer";
}
