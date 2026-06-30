import type { EditorMode, ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type StandardCanvasPoint = {
  x: number;
  y: number;
};

export type StandardCanvasRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StandardCanvasSelection = {
  itemIds: string[];
  connectionIds: string[];
  groupIds?: string[];
  primaryId?: string;
};

export type StandardCanvasHitTarget =
  | { kind: "blank" }
  | { kind: "item"; id: string }
  | { kind: "itemAnchor"; itemId: string; anchor: string }
  | { kind: "group"; id: string }
  | { kind: "groupTitle"; id: string }
  | { kind: "groupAnchor"; groupId: string; anchor: string }
  | { kind: "connection"; id: string }
  | { kind: "connectionLabel"; id: string }
  | { kind: "connectionEndpoint"; connectionId: string; side: "from" | "to" }
  | { kind: "resizeHandle"; itemId: string };

export type StandardCanvasInteractionState =
  | { kind: "idle" }
  | {
      kind: "pendingBlankPointer";
      pointerId: number;
      startScreen: StandardCanvasPoint;
      startWorld: StandardCanvasPoint;
      startedAt: number;
      selectionVersion: number;
    }
  | {
      kind: "pendingItemPointer";
      itemId: string;
      pointerId: number;
      startScreen: StandardCanvasPoint;
      startWorld: StandardCanvasPoint;
      startedAt: number;
      selectionVersion: number;
    }
  | {
      kind: "pendingGroupPointer";
      groupId: string;
      pointerId: number;
      startScreen: StandardCanvasPoint;
      startWorld: StandardCanvasPoint;
      startedAt: number;
      selectionVersion: number;
    }
  | { kind: "marqueeSelecting"; pointerId: number; startWorld: StandardCanvasPoint; currentWorld: StandardCanvasPoint }
  | { kind: "draggingItems"; pointerId: number; itemId: string; startScreen: StandardCanvasPoint; startWorld: StandardCanvasPoint }
  | { kind: "draggingGroups"; pointerId: number; groupId: string; startScreen: StandardCanvasPoint; startWorld: StandardCanvasPoint }
  | { kind: "resizingItem"; pointerId: number; itemId: string; startScreen: StandardCanvasPoint; startWorld: StandardCanvasPoint; currentWorld: StandardCanvasPoint }
  | { kind: "panning"; pointerId: number; startScreen: StandardCanvasPoint; originViewport: ViewportState }
  | {
      kind: "connecting";
      pointerId: number;
      fromId: string;
      fromAnchor?: string;
      startWorld: StandardCanvasPoint;
      currentWorld: StandardCanvasPoint;
    }
  | { kind: "retargetingConnection"; pointerId: number; connectionId: string; side: "from" | "to"; currentWorld: StandardCanvasPoint }
  | { kind: "editingItemText"; itemId: string }
  | { kind: "editingGroupText"; groupId: string }
  | { kind: "editingConnectionText"; connectionId: string };

export type StandardBlankClickIntent = {
  target: "blank";
  pointerId: number;
  screen: StandardCanvasPoint;
  world: StandardCanvasPoint;
  time: number;
  selectionVersion: number;
  interactionGeneration: number;
};

export type StandardPointerDownInput = {
  state: StandardCanvasInteractionState;
  tool: EditorMode;
  hit: StandardCanvasHitTarget;
  button: number;
  screen: StandardCanvasPoint;
  world: StandardCanvasPoint;
  now: number;
  selectionVersion: number;
  viewport: ViewportState;
  pointerId?: number;
  panningRequested?: boolean;
};

export type StandardPointerMoveInput = {
  state: StandardCanvasInteractionState;
  screen: StandardCanvasPoint;
  world: StandardCanvasPoint;
};

export type StandardInteractionTransition = {
  state: StandardCanvasInteractionState;
  clearBlankClickIntent: boolean;
};

export type StandardBlankClickResolution =
  | { action: "ignore"; intent: null }
  | { action: "clearSelection"; intent: null }
  | { action: "record"; intent: StandardBlankClickIntent }
  | { action: "addItem"; intent: null; point: StandardCanvasPoint };

export type StandardInlineEditCommandTarget = { type: "item" | "group" | "connection"; id: string };

export type StandardCanvasInteractionCommand =
  | { type: "blankClick.invalidate" }
  | { type: "selection.clear" }
  | { type: "blankClick.record"; intent: StandardBlankClickIntent }
  | { type: "item.addAt"; point: StandardCanvasPoint }
  | { type: "selection.selectItem"; id: string; additive: boolean }
  | { type: "selection.selectGroup"; id: string; additive: boolean }
  | { type: "selection.selectConnection"; id: string; additive: boolean }
  | { type: "text.editStart"; target: StandardInlineEditCommandTarget }
  | { type: "item.dragStart"; itemId: string }
  | { type: "group.dragStart"; groupId: string }
  | { type: "selection.marquee"; rect: StandardCanvasRect }
  | { type: "connection.finish"; draft: Extract<StandardCanvasInteractionState, { kind: "connecting" }> }
  | { type: "connection.retarget"; connectionId: string; side: "from" | "to"; point: StandardCanvasPoint }
  | { type: "interaction.reset" };

export type StandardCanvasDispatchResult = {
  state: StandardCanvasInteractionState;
  commands: StandardCanvasInteractionCommand[];
};

export const STANDARD_CANVAS_DRAG_THRESHOLD_PX = 4;
export const STANDARD_BLANK_DOUBLE_CLICK_MS = 360;
export const STANDARD_BLANK_DOUBLE_CLICK_DISTANCE_PX = 8;

export const standardIdleInteraction: StandardCanvasInteractionState = { kind: "idle" };

export function standardHasSelection(selection: StandardCanvasSelection) {
  return selection.itemIds.length > 0 || selection.connectionIds.length > 0 || (selection.groupIds?.length || 0) > 0;
}

export function standardSelectionVersionKey(selection: StandardCanvasSelection) {
  return [...selection.itemIds, "|", ...selection.connectionIds, "|", ...(selection.groupIds || [])].join(",");
}

export function isStandardPanningButton(button: number) {
  return button === 1 || button === 2;
}

export function beginStandardCanvasPointer(input: StandardPointerDownInput): StandardInteractionTransition {
  const pointerId = input.pointerId ?? 0;
  if (input.state.kind !== "idle") {
    return { state: input.state, clearBlankClickIntent: true };
  }

  if (isStandardPanningButton(input.button) || input.panningRequested) {
    return {
      state: {
        kind: "panning",
        pointerId,
        startScreen: input.screen,
        originViewport: input.viewport
      },
      clearBlankClickIntent: true
    };
  }

  if (input.button !== 0) {
    return { state: input.state, clearBlankClickIntent: true };
  }

  if (input.tool === "select") {
    if (input.hit.kind === "blank") {
      return {
        state: {
          kind: "pendingBlankPointer",
          pointerId,
          startScreen: input.screen,
          startWorld: input.world,
          startedAt: input.now,
          selectionVersion: input.selectionVersion
        },
        clearBlankClickIntent: false
      };
    }

    if (input.hit.kind === "resizeHandle") {
      return {
        state: {
          kind: "resizingItem",
          pointerId,
          itemId: input.hit.itemId,
          startScreen: input.screen,
          startWorld: input.world,
          currentWorld: input.world
        },
        clearBlankClickIntent: true
      };
    }

    if (input.hit.kind === "item") {
      return {
        state: {
          kind: "pendingItemPointer",
          itemId: input.hit.id,
          pointerId,
          startScreen: input.screen,
          startWorld: input.world,
          startedAt: input.now,
          selectionVersion: input.selectionVersion
        },
        clearBlankClickIntent: true
      };
    }

    if (input.hit.kind === "itemAnchor") {
      return {
        state: {
          kind: "connecting",
          pointerId,
          fromId: input.hit.itemId,
          fromAnchor: input.hit.anchor,
          startWorld: input.world,
          currentWorld: input.world
        },
        clearBlankClickIntent: true
      };
    }

    if (input.hit.kind === "group" || input.hit.kind === "groupTitle") {
      return {
        state: {
          kind: "pendingGroupPointer",
          groupId: input.hit.id,
          pointerId,
          startScreen: input.screen,
          startWorld: input.world,
          startedAt: input.now,
          selectionVersion: input.selectionVersion
        },
        clearBlankClickIntent: true
      };
    }

    if (input.hit.kind === "groupAnchor") {
      return {
        state: {
          kind: "connecting",
          pointerId,
          fromId: input.hit.groupId,
          fromAnchor: input.hit.anchor,
          startWorld: input.world,
          currentWorld: input.world
        },
        clearBlankClickIntent: true
      };
    }

    if (input.hit.kind === "connectionEndpoint") {
      return {
        state: {
          kind: "retargetingConnection",
          pointerId,
          connectionId: input.hit.connectionId,
          side: input.hit.side,
          currentWorld: input.world
        },
        clearBlankClickIntent: true
      };
    }
  }

  if (
    input.tool === "connect" &&
    (input.hit.kind === "item" || input.hit.kind === "itemAnchor" || input.hit.kind === "group" || input.hit.kind === "groupTitle" || input.hit.kind === "groupAnchor")
  ) {
    const fromId =
      input.hit.kind === "item"
        ? input.hit.id
        : input.hit.kind === "itemAnchor"
          ? input.hit.itemId
          : input.hit.kind === "group" || input.hit.kind === "groupTitle"
            ? input.hit.id
            : input.hit.groupId;
    const fromAnchor = input.hit.kind === "itemAnchor" || input.hit.kind === "groupAnchor" ? input.hit.anchor : undefined;

    return {
      state: {
        kind: "connecting",
        pointerId,
        fromId,
        ...(fromAnchor ? { fromAnchor } : {}),
        startWorld: input.world,
        currentWorld: input.world
      },
      clearBlankClickIntent: true
    };
  }

  return { state: input.state, clearBlankClickIntent: input.hit.kind !== "blank" };
}

export function dispatchStandardCanvasPointerDown(input: StandardPointerDownInput): StandardCanvasDispatchResult {
  const transition = beginStandardCanvasPointer(input);

  return {
    state: transition.state,
    commands: transition.clearBlankClickIntent ? [{ type: "blankClick.invalidate" }] : []
  };
}

export function updateStandardCanvasPointer(input: StandardPointerMoveInput): StandardInteractionTransition {
  const { state, screen, world } = input;

  if (state.kind === "pendingBlankPointer" && movedBeyondThreshold(state.startScreen, screen)) {
    return {
      state: { kind: "marqueeSelecting", pointerId: state.pointerId, startWorld: state.startWorld, currentWorld: world },
      clearBlankClickIntent: true
    };
  }

  if (state.kind === "pendingItemPointer" && movedBeyondThreshold(state.startScreen, screen)) {
    return {
      state: {
        kind: "draggingItems",
        pointerId: state.pointerId,
        itemId: state.itemId,
        startScreen: state.startScreen,
        startWorld: state.startWorld
      },
      clearBlankClickIntent: true
    };
  }

  if (state.kind === "pendingGroupPointer" && movedBeyondThreshold(state.startScreen, screen)) {
    return {
      state: {
        kind: "draggingGroups",
        pointerId: state.pointerId,
        groupId: state.groupId,
        startScreen: state.startScreen,
        startWorld: state.startWorld
      },
      clearBlankClickIntent: true
    };
  }

  if (state.kind === "marqueeSelecting") {
    return { state: { ...state, currentWorld: world }, clearBlankClickIntent: false };
  }

  if (state.kind === "resizingItem") {
    return { state: { ...state, currentWorld: world }, clearBlankClickIntent: false };
  }

  if (state.kind === "connecting") {
    return { state: { ...state, currentWorld: world }, clearBlankClickIntent: false };
  }

  if (state.kind === "retargetingConnection") {
    return { state: { ...state, currentWorld: world }, clearBlankClickIntent: false };
  }

  return { state, clearBlankClickIntent: false };
}

export function dispatchStandardCanvasPointerMove(input: StandardPointerMoveInput): StandardCanvasDispatchResult {
  const transition = updateStandardCanvasPointer(input);
  const commands: StandardCanvasInteractionCommand[] = [];

  if (transition.clearBlankClickIntent) {
    commands.push({ type: "blankClick.invalidate" });
  }

  if (input.state.kind === "pendingItemPointer" && transition.state.kind === "draggingItems") {
    commands.push({ type: "item.dragStart", itemId: transition.state.itemId });
  }

  if (input.state.kind === "pendingGroupPointer" && transition.state.kind === "draggingGroups") {
    commands.push({ type: "group.dragStart", groupId: transition.state.groupId });
  }

  return {
    state: transition.state,
    commands
  };
}

export function dispatchStandardCanvasPointerUp(input: {
  state: StandardCanvasInteractionState;
  tool: EditorMode;
  hit: StandardCanvasHitTarget;
  hasSelection: boolean;
  screen: StandardCanvasPoint;
  world: StandardCanvasPoint;
  now: number;
  previousBlankClick: StandardBlankClickIntent | null;
  selectionVersion: number;
  interactionGeneration: number;
  pointerId?: number;
}): StandardCanvasDispatchResult {
  const commands: StandardCanvasInteractionCommand[] = [];

  if (input.state.kind === "pendingBlankPointer" && input.hit.kind === "blank") {
    const result = resolveStandardBlankClick({
      previous: input.previousBlankClick,
      tool: input.tool,
      state: input.state,
      hasSelection: input.hasSelection,
      screen: input.screen,
      world: input.world,
      now: input.now,
      pointerId: input.pointerId,
      selectionVersion: input.selectionVersion,
      interactionGeneration: input.interactionGeneration
    });

    if (result.action === "clearSelection") {
      commands.push({ type: "selection.clear" });
    } else if (result.action === "record") {
      commands.push({ type: "blankClick.record", intent: result.intent });
    } else if (result.action === "addItem") {
      commands.push({ type: "item.addAt", point: result.point });
      commands.push({ type: "blankClick.invalidate" });
    }
  }

  if (input.state.kind === "marqueeSelecting") {
    commands.push({ type: "selection.marquee", rect: normalizeWorldRect(input.state.startWorld, input.state.currentWorld) });
    commands.push({ type: "blankClick.invalidate" });
  }

  if (input.state.kind === "connecting") {
    commands.push({ type: "connection.finish", draft: input.state });
    commands.push({ type: "blankClick.invalidate" });
  }

  if (input.state.kind === "retargetingConnection") {
    commands.push({ type: "connection.retarget", connectionId: input.state.connectionId, side: input.state.side, point: input.world });
    commands.push({ type: "blankClick.invalidate" });
  }

  commands.push({ type: "interaction.reset" });

  return {
    state: standardIdleInteraction,
    commands
  };
}

export function dispatchStandardCanvasClick(input: { tool: EditorMode; hit: StandardCanvasHitTarget; shiftKey: boolean }): StandardCanvasInteractionCommand[] {
  if (input.hit.kind === "blank") return [];

  const commands: StandardCanvasInteractionCommand[] = [{ type: "blankClick.invalidate" }];
  if (input.tool !== "select") return commands;

  if (input.hit.kind === "item") {
    commands.push({ type: "selection.selectItem", id: input.hit.id, additive: input.shiftKey });
  }

  if (input.hit.kind === "itemAnchor" || input.hit.kind === "resizeHandle") {
    commands.push({ type: "selection.selectItem", id: input.hit.kind === "itemAnchor" ? input.hit.itemId : input.hit.itemId, additive: input.shiftKey });
  }

  if (input.hit.kind === "group" || input.hit.kind === "groupTitle") {
    commands.push({ type: "selection.selectGroup", id: input.hit.id, additive: input.shiftKey });
  }

  if (input.hit.kind === "groupAnchor") {
    commands.push({ type: "selection.selectGroup", id: input.hit.groupId, additive: input.shiftKey });
  }

  if (input.hit.kind === "connection" || input.hit.kind === "connectionLabel") {
    commands.push({ type: "selection.selectConnection", id: input.hit.id, additive: input.shiftKey });
  }

  if (input.hit.kind === "connectionEndpoint") {
    commands.push({ type: "selection.selectConnection", id: input.hit.connectionId, additive: input.shiftKey });
  }

  return commands;
}

export function dispatchStandardCanvasDoubleClick(input: { tool: EditorMode; hit: StandardCanvasHitTarget }): StandardCanvasInteractionCommand[] {
  if (input.hit.kind === "blank") return [];

  const commands: StandardCanvasInteractionCommand[] = [{ type: "blankClick.invalidate" }];
  if (input.tool !== "select") return commands;

  if (input.hit.kind === "item" || input.hit.kind === "itemAnchor" || input.hit.kind === "resizeHandle") {
    const id = input.hit.kind === "item" ? input.hit.id : input.hit.itemId;
    commands.push({ type: "selection.selectItem", id, additive: false });
    commands.push({ type: "text.editStart", target: { type: "item", id } });
  }

  if (input.hit.kind === "group" || input.hit.kind === "groupTitle" || input.hit.kind === "groupAnchor") {
    const id = input.hit.kind === "group" || input.hit.kind === "groupTitle" ? input.hit.id : input.hit.groupId;
    commands.push({ type: "selection.selectGroup", id, additive: false });
    if (input.hit.kind === "groupTitle") commands.push({ type: "text.editStart", target: { type: "group", id } });
  }

  if (input.hit.kind === "connection" || input.hit.kind === "connectionLabel") {
    commands.push({ type: "selection.selectConnection", id: input.hit.id, additive: false });
    commands.push({ type: "text.editStart", target: { type: "connection", id: input.hit.id } });
  }

  if (input.hit.kind === "connectionEndpoint") {
    commands.push({ type: "selection.selectConnection", id: input.hit.connectionId, additive: false });
  }

  return commands;
}

export function resolveStandardBlankClick(input: {
  previous: StandardBlankClickIntent | null;
  tool: EditorMode;
  state: StandardCanvasInteractionState;
  hasSelection: boolean;
  screen: StandardCanvasPoint;
  world: StandardCanvasPoint;
  now: number;
  pointerId?: number;
  selectionVersion: number;
  interactionGeneration: number;
}): StandardBlankClickResolution {
  if (input.tool !== "select" || input.state.kind !== "pendingBlankPointer") {
    return { action: "ignore", intent: null };
  }

  if (input.hasSelection) {
    return { action: "clearSelection", intent: null };
  }

  const pointerId = input.pointerId ?? input.state.pointerId;
  if (isValidSecondBlankClick(input.previous, input.screen, input.now, pointerId, input.selectionVersion, input.interactionGeneration)) {
    return { action: "addItem", intent: null, point: input.world };
  }

  return {
    action: "record",
    intent: {
      target: "blank",
      pointerId,
      screen: input.screen,
      world: input.world,
      time: input.now,
      selectionVersion: input.selectionVersion,
      interactionGeneration: input.interactionGeneration
    }
  };
}

export function standardInteractionCursor(tool: EditorMode, state: StandardCanvasInteractionState, panningRequested: boolean, hit?: StandardCanvasHitTarget) {
  if (state.kind === "panning") return "cursor-grabbing";
  if (panningRequested) return "cursor-grab";
  if (state.kind === "draggingItems" || state.kind === "draggingGroups" || state.kind === "resizingItem") return "cursor-grabbing";
  if (isStandardEditingInteraction(state)) return "cursor-text";
  if (state.kind === "connecting" || state.kind === "retargetingConnection" || tool === "connect") return "cursor-crosshair";
  if (tool === "select" && (hit?.kind === "itemAnchor" || hit?.kind === "groupAnchor" || hit?.kind === "connectionEndpoint")) return "cursor-crosshair";
  return "cursor-default";
}

export function isStandardEditingInteraction(state: StandardCanvasInteractionState) {
  return state.kind === "editingItemText" || state.kind === "editingGroupText" || state.kind === "editingConnectionText";
}

export function movedBeyondThreshold(start: StandardCanvasPoint, current: StandardCanvasPoint, threshold = STANDARD_CANVAS_DRAG_THRESHOLD_PX) {
  return distance(start, current) > threshold;
}

function isValidSecondBlankClick(
  previous: StandardBlankClickIntent | null,
  screen: StandardCanvasPoint,
  now: number,
  pointerId: number,
  selectionVersion: number,
  interactionGeneration: number
) {
  if (!previous) return false;
  if (previous.pointerId !== pointerId) return false;
  if (previous.selectionVersion !== selectionVersion) return false;
  if (previous.interactionGeneration !== interactionGeneration) return false;
  if (now - previous.time > STANDARD_BLANK_DOUBLE_CLICK_MS) return false;
  return distance(previous.screen, screen) <= STANDARD_BLANK_DOUBLE_CLICK_DISTANCE_PX;
}

function distance(a: StandardCanvasPoint, b: StandardCanvasPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeWorldRect(start: StandardCanvasPoint, end: StandardCanvasPoint): StandardCanvasRect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}
