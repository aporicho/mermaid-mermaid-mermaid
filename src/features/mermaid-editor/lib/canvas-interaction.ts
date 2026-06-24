import type { EditorMode, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import {
  beginStandardCanvasPointer,
  dispatchStandardCanvasClick,
  dispatchStandardCanvasDoubleClick,
  dispatchStandardCanvasPointerDown,
  dispatchStandardCanvasPointerMove,
  dispatchStandardCanvasPointerUp,
  isStandardEditingInteraction,
  isStandardPanningButton,
  movedBeyondThreshold as movedBeyondStandardThreshold,
  resolveStandardBlankClick,
  standardHasSelection,
  standardIdleInteraction,
  standardInteractionCursor,
  standardSelectionVersionKey,
  updateStandardCanvasPointer,
  type StandardBlankClickIntent,
  type StandardCanvasDispatchResult,
  type StandardCanvasHitTarget,
  type StandardCanvasInteractionCommand,
  type StandardCanvasInteractionState,
  type StandardCanvasPoint,
  type StandardCanvasRect,
  type StandardCanvasSelection
} from "@/features/mermaid-editor/lib/canvas-interaction-standard";

export type CanvasPoint = StandardCanvasPoint;

export type HitTarget =
  | { kind: "blank" }
  | { kind: "node"; id: string }
  | { kind: "nodeAnchor"; nodeId: string; anchor: string }
  | { kind: "subgraph"; id: string }
  | { kind: "subgraphAnchor"; subgraphId: string; anchor: string }
  | { kind: "edge"; id: string }
  | { kind: "edgeLabel"; id: string }
  | { kind: "edgeEndpoint"; edgeId: string; side: "from" | "to" };

export type InteractionState =
  | { kind: "idle" }
  | {
      kind: "pendingBlankPointer";
      pointerId: number;
      startScreen: CanvasPoint;
      startWorld: CanvasPoint;
      startedAt: number;
      selectionVersion: number;
    }
  | {
      kind: "pendingNodePointer";
      nodeId: string;
      pointerId: number;
      startScreen: CanvasPoint;
      startWorld: CanvasPoint;
      startedAt: number;
      selectionVersion: number;
    }
  | {
      kind: "pendingSubgraphPointer";
      subgraphId: string;
      pointerId: number;
      startScreen: CanvasPoint;
      startWorld: CanvasPoint;
      startedAt: number;
      selectionVersion: number;
    }
  | { kind: "marqueeSelecting"; pointerId: number; startWorld: CanvasPoint; currentWorld: CanvasPoint }
  | { kind: "draggingNodes"; pointerId: number; nodeId: string; startScreen: CanvasPoint; startWorld: CanvasPoint }
  | { kind: "draggingSubgraphs"; pointerId: number; subgraphId: string; startScreen: CanvasPoint; startWorld: CanvasPoint }
  | { kind: "panning"; pointerId: number; startScreen: CanvasPoint; originViewport: ViewportState }
  | {
      kind: "connectingEdge";
      pointerId: number;
      fromId: string;
      fromAnchor?: string;
      startWorld: CanvasPoint;
      currentWorld: CanvasPoint;
    }
  | { kind: "retargetingEdge"; pointerId: number; edgeId: string; side: "from" | "to"; currentWorld: CanvasPoint }
  | { kind: "editingNodeText"; nodeId: string }
  | { kind: "editingEdgeLabel"; edgeId: string };

export type BlankClickIntent = StandardBlankClickIntent;

export type PointerDownInput = {
  state: InteractionState;
  tool: EditorMode;
  hit: HitTarget;
  button: number;
  screen: CanvasPoint;
  world: CanvasPoint;
  now: number;
  selectionVersion: number;
  viewport: ViewportState;
  panningRequested?: boolean;
};

export type PointerMoveInput = {
  state: InteractionState;
  screen: CanvasPoint;
  world: CanvasPoint;
};

export type InteractionTransition = {
  state: InteractionState;
  clearBlankClickIntent: boolean;
};

export type BlankClickResolution =
  | { action: "ignore"; intent: null }
  | { action: "clearSelection"; intent: null }
  | { action: "record"; intent: BlankClickIntent }
  | { action: "addNode"; intent: null; point: CanvasPoint };

export type CanvasRect = StandardCanvasRect;

export type InlineEditCommandTarget = { type: "node" | "edge"; id: string };

export type CanvasInteractionCommand =
  | { type: "invalidateBlankClick" }
  | { type: "clearSelection" }
  | { type: "recordBlankClick"; intent: BlankClickIntent }
  | { type: "addNodeAt"; point: CanvasPoint }
  | { type: "selectNode"; id: string; additive: boolean }
  | { type: "selectSubgraph"; id: string; additive: boolean }
  | { type: "selectEdge"; id: string; additive: boolean }
  | { type: "startInlineEdit"; target: InlineEditCommandTarget }
  | { type: "startNodeDrag"; nodeId: string }
  | { type: "startSubgraphDrag"; subgraphId: string }
  | { type: "selectMarquee"; rect: CanvasRect }
  | { type: "finishConnection"; draft: Extract<InteractionState, { kind: "connectingEdge" }> }
  | { type: "retargetEdge"; edgeId: string; side: "from" | "to"; point: CanvasPoint }
  | { type: "resetInteraction" };

export type CanvasDispatchResult = {
  state: InteractionState;
  commands: CanvasInteractionCommand[];
};

export const CANVAS_DRAG_THRESHOLD_PX = 4;
export const BLANK_DOUBLE_CLICK_MS = 360;
export const BLANK_DOUBLE_CLICK_DISTANCE_PX = 8;

export const idleInteraction: InteractionState = fromStandardState(standardIdleInteraction);

export function hasSelection(selection: Selection) {
  return standardHasSelection(toStandardSelection(selection));
}

export function selectionVersionKey(selection: Selection) {
  return standardSelectionVersionKey(toStandardSelection(selection));
}

export function isPanningButton(button: number) {
  return isStandardPanningButton(button);
}

export function beginCanvasPointer(input: PointerDownInput): InteractionTransition {
  const transition = beginStandardCanvasPointer({
    ...input,
    state: toStandardState(input.state),
    hit: toStandardHitTarget(input.hit)
  });

  return {
    state: fromStandardState(transition.state),
    clearBlankClickIntent: transition.clearBlankClickIntent
  };
}

export function dispatchCanvasPointerDown(input: PointerDownInput): CanvasDispatchResult {
  return fromStandardDispatchResult(
    dispatchStandardCanvasPointerDown({
      ...input,
      state: toStandardState(input.state),
      hit: toStandardHitTarget(input.hit)
    })
  );
}

export function updateCanvasPointer(input: PointerMoveInput): InteractionTransition {
  const transition = updateStandardCanvasPointer({
    ...input,
    state: toStandardState(input.state)
  });

  return {
    state: fromStandardState(transition.state),
    clearBlankClickIntent: transition.clearBlankClickIntent
  };
}

export function dispatchCanvasPointerMove(input: PointerMoveInput): CanvasDispatchResult {
  return fromStandardDispatchResult(
    dispatchStandardCanvasPointerMove({
      ...input,
      state: toStandardState(input.state)
    })
  );
}

export function dispatchCanvasPointerUp(input: {
  state: InteractionState;
  tool: EditorMode;
  hit: HitTarget;
  hasSelection: boolean;
  screen: CanvasPoint;
  world: CanvasPoint;
  now: number;
  previousBlankClick: BlankClickIntent | null;
  selectionVersion: number;
  interactionGeneration: number;
}): CanvasDispatchResult {
  return fromStandardDispatchResult(
    dispatchStandardCanvasPointerUp({
      ...input,
      state: toStandardState(input.state),
      hit: toStandardHitTarget(input.hit)
    })
  );
}

export function dispatchCanvasClick(input: { tool: EditorMode; hit: HitTarget; shiftKey: boolean }): CanvasInteractionCommand[] {
  return fromStandardCommands(dispatchStandardCanvasClick({ ...input, hit: toStandardHitTarget(input.hit) }));
}

export function dispatchCanvasDoubleClick(input: { tool: EditorMode; hit: HitTarget }): CanvasInteractionCommand[] {
  return fromStandardCommands(dispatchStandardCanvasDoubleClick({ ...input, hit: toStandardHitTarget(input.hit) }));
}

export function resolveBlankClick(input: {
  previous: BlankClickIntent | null;
  tool: EditorMode;
  state: InteractionState;
  hasSelection: boolean;
  screen: CanvasPoint;
  world: CanvasPoint;
  now: number;
  pointerId?: number;
  selectionVersion: number;
  interactionGeneration: number;
}): BlankClickResolution {
  const result = resolveStandardBlankClick({
    ...input,
    state: toStandardState(input.state)
  });

  if (result.action === "addItem") return { action: "addNode", intent: null, point: result.point };
  return result;
}

export function interactionCursor(tool: EditorMode, state: InteractionState, panningRequested: boolean, hit?: HitTarget) {
  return standardInteractionCursor(tool, toStandardState(state), panningRequested, hit ? toStandardHitTarget(hit) : undefined);
}

export function isEditingInteraction(state: InteractionState) {
  return isStandardEditingInteraction(toStandardState(state));
}

export function movedBeyondThreshold(start: CanvasPoint, current: CanvasPoint, threshold = CANVAS_DRAG_THRESHOLD_PX) {
  return movedBeyondStandardThreshold(start, current, threshold);
}

function toStandardSelection(selection: Selection): StandardCanvasSelection {
  return {
    itemIds: selection.nodeIds || [],
    connectionIds: selection.edgeIds || [],
    groupIds: selection.subgraphIds || [],
    primaryId: selection.primaryId
  };
}

function toStandardHitTarget(hit: HitTarget): StandardCanvasHitTarget {
  if (hit.kind === "blank") return hit;
  if (hit.kind === "node") return { kind: "item", id: hit.id };
  if (hit.kind === "nodeAnchor") return { kind: "itemAnchor", itemId: hit.nodeId, anchor: hit.anchor };
  if (hit.kind === "subgraph") return { kind: "group", id: hit.id };
  if (hit.kind === "subgraphAnchor") return { kind: "groupAnchor", groupId: hit.subgraphId, anchor: hit.anchor };
  if (hit.kind === "edge") return { kind: "connection", id: hit.id };
  if (hit.kind === "edgeLabel") return { kind: "connectionLabel", id: hit.id };
  return { kind: "connectionEndpoint", connectionId: hit.edgeId, side: hit.side };
}

function toStandardState(state: InteractionState): StandardCanvasInteractionState {
  if (state.kind === "idle") return state;
  if (state.kind === "pendingBlankPointer") return state;
  if (state.kind === "pendingNodePointer") {
    return {
      kind: "pendingItemPointer",
      itemId: state.nodeId,
      pointerId: state.pointerId,
      startScreen: state.startScreen,
      startWorld: state.startWorld,
      startedAt: state.startedAt,
      selectionVersion: state.selectionVersion
    };
  }
  if (state.kind === "pendingSubgraphPointer") {
    return {
      kind: "pendingGroupPointer",
      groupId: state.subgraphId,
      pointerId: state.pointerId,
      startScreen: state.startScreen,
      startWorld: state.startWorld,
      startedAt: state.startedAt,
      selectionVersion: state.selectionVersion
    };
  }
  if (state.kind === "marqueeSelecting") return state;
  if (state.kind === "draggingNodes") {
    return {
      kind: "draggingItems",
      itemId: state.nodeId,
      pointerId: state.pointerId,
      startScreen: state.startScreen,
      startWorld: state.startWorld
    };
  }
  if (state.kind === "draggingSubgraphs") {
    return {
      kind: "draggingGroups",
      groupId: state.subgraphId,
      pointerId: state.pointerId,
      startScreen: state.startScreen,
      startWorld: state.startWorld
    };
  }
  if (state.kind === "panning") return state;
  if (state.kind === "connectingEdge") {
    return {
      kind: "connecting",
      pointerId: state.pointerId,
      fromId: state.fromId,
      ...(state.fromAnchor ? { fromAnchor: state.fromAnchor } : {}),
      startWorld: state.startWorld,
      currentWorld: state.currentWorld
    };
  }
  if (state.kind === "retargetingEdge") {
    return {
      kind: "retargetingConnection",
      pointerId: state.pointerId,
      connectionId: state.edgeId,
      side: state.side,
      currentWorld: state.currentWorld
    };
  }
  if (state.kind === "editingNodeText") return { kind: "editingItemText", itemId: state.nodeId };
  return { kind: "editingConnectionText", connectionId: state.edgeId };
}

function fromStandardState(state: StandardCanvasInteractionState): InteractionState {
  if (state.kind === "idle") return state;
  if (state.kind === "pendingBlankPointer") return state;
  if (state.kind === "pendingItemPointer") {
    return {
      kind: "pendingNodePointer",
      nodeId: state.itemId,
      pointerId: state.pointerId,
      startScreen: state.startScreen,
      startWorld: state.startWorld,
      startedAt: state.startedAt,
      selectionVersion: state.selectionVersion
    };
  }
  if (state.kind === "pendingGroupPointer") {
    return {
      kind: "pendingSubgraphPointer",
      subgraphId: state.groupId,
      pointerId: state.pointerId,
      startScreen: state.startScreen,
      startWorld: state.startWorld,
      startedAt: state.startedAt,
      selectionVersion: state.selectionVersion
    };
  }
  if (state.kind === "marqueeSelecting") return state;
  if (state.kind === "draggingItems") {
    return {
      kind: "draggingNodes",
      nodeId: state.itemId,
      pointerId: state.pointerId,
      startScreen: state.startScreen,
      startWorld: state.startWorld
    };
  }
  if (state.kind === "draggingGroups") {
    return {
      kind: "draggingSubgraphs",
      subgraphId: state.groupId,
      pointerId: state.pointerId,
      startScreen: state.startScreen,
      startWorld: state.startWorld
    };
  }
  if (state.kind === "panning") return state;
  if (state.kind === "connecting") {
    return {
      kind: "connectingEdge",
      pointerId: state.pointerId,
      fromId: state.fromId,
      ...(state.fromAnchor ? { fromAnchor: state.fromAnchor } : {}),
      startWorld: state.startWorld,
      currentWorld: state.currentWorld
    };
  }
  if (state.kind === "retargetingConnection") {
    return {
      kind: "retargetingEdge",
      pointerId: state.pointerId,
      edgeId: state.connectionId,
      side: state.side,
      currentWorld: state.currentWorld
    };
  }
  if (state.kind === "editingItemText") return { kind: "editingNodeText", nodeId: state.itemId };
  if (state.kind === "editingConnectionText") return { kind: "editingEdgeLabel", edgeId: state.connectionId };
  return idleInteraction;
}

function fromStandardDispatchResult(result: StandardCanvasDispatchResult): CanvasDispatchResult {
  return {
    state: fromStandardState(result.state),
    commands: fromStandardCommands(result.commands)
  };
}

function fromStandardCommands(commands: StandardCanvasInteractionCommand[]): CanvasInteractionCommand[] {
  return commands.map(fromStandardCommand).filter((command): command is CanvasInteractionCommand => Boolean(command));
}

function fromStandardCommand(command: StandardCanvasInteractionCommand): CanvasInteractionCommand | null {
  if (command.type === "blankClick.invalidate") return { type: "invalidateBlankClick" };
  if (command.type === "selection.clear") return { type: "clearSelection" };
  if (command.type === "blankClick.record") return { type: "recordBlankClick", intent: command.intent };
  if (command.type === "item.addAt") return { type: "addNodeAt", point: command.point };
  if (command.type === "selection.selectItem") return { type: "selectNode", id: command.id, additive: command.additive };
  if (command.type === "selection.selectGroup") return { type: "selectSubgraph", id: command.id, additive: command.additive };
  if (command.type === "selection.selectConnection") return { type: "selectEdge", id: command.id, additive: command.additive };
  if (command.type === "text.editStart") {
    return { type: "startInlineEdit", target: command.target.type === "item" ? { type: "node", id: command.target.id } : { type: "edge", id: command.target.id } };
  }
  if (command.type === "item.dragStart") return { type: "startNodeDrag", nodeId: command.itemId };
  if (command.type === "group.dragStart") return { type: "startSubgraphDrag", subgraphId: command.groupId };
  if (command.type === "selection.marquee") return { type: "selectMarquee", rect: command.rect };
  if (command.type === "connection.finish") return { type: "finishConnection", draft: fromStandardState(command.draft) as Extract<InteractionState, { kind: "connectingEdge" }> };
  if (command.type === "connection.retarget") return { type: "retargetEdge", edgeId: command.connectionId, side: command.side, point: command.point };
  if (command.type === "interaction.reset") return { type: "resetInteraction" };
  return null;
}
