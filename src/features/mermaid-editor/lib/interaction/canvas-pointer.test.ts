import { describe, expect, it } from "vitest";

import type { InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import {
  resolveCanvasPointerClick,
  resolveCanvasPointerDoubleClick,
  resolveCanvasPointerMove,
  resolveCanvasPointerUp
} from "@/features/mermaid-editor/lib/interaction/canvas-pointer";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import { emptyInteractionModifiers, type StandardPointerInput } from "@/features/mermaid-editor/lib/interaction/input";
import { DEFAULT_VIEW_FILTERS } from "@/features/mermaid-editor/lib/view-filters";

const graph: MermaidGraph = {
  direction: "LR",
  nodes: [
    { id: "A", label: "A", x: 0, y: 0, fill: "#fff" },
    { id: "B", label: "B", x: 200, y: 0, fill: "#fff" }
  ],
  edges: [{ id: "A_B", from: "A", to: "B", label: "", style: "solid", arrowType: "arrow" }],
  subgraphs: [{ id: "Group", title: "Group", nodeIds: ["A"] }]
};

const viewport = { x: 0, y: 0, scale: 1 };

function context(selection: Selection = { nodeIds: [], edgeIds: [], subgraphIds: [] }) {
  return buildInteractionContext({
    graph,
    selection,
    viewport,
    viewFilters: DEFAULT_VIEW_FILTERS,
    mode: "select"
  });
}

function pointer(overrides: Partial<StandardPointerInput> = {}): StandardPointerInput {
  return {
    kind: "pointer",
    entry: "web-ui",
    phase: "click",
    pointerId: 0,
    button: 0,
    screen: { x: 100, y: 100 },
    world: { x: 100, y: 100 },
    hit: { kind: "blank" },
    modifiers: emptyInteractionModifiers,
    timestamp: 1000,
    ...overrides
  };
}

describe("canvas pointer interaction adapter", () => {
  it("turns node clicks into selection commands", () => {
    const result = resolveCanvasPointerClick(pointer({ hit: { kind: "node", id: "A" } }), context());

    expect(result.localEffects).toEqual([{ type: "blankClick.invalidate" }]);
    expect(result.editorCommands).toEqual([
      { type: "selection.set", selection: { nodeIds: ["A"], edgeIds: [], subgraphIds: [], primaryId: "A" }, source: "pointer" }
    ]);
  });

  it("uses additive selection for shift-clicks", () => {
    const result = resolveCanvasPointerClick(
      pointer({ hit: { kind: "node", id: "B" }, modifiers: { ...emptyInteractionModifiers, shiftKey: true } }),
      context({ nodeIds: ["A"], edgeIds: [], subgraphIds: [], primaryId: "A" })
    );

    expect(result.editorCommands).toEqual([
      { type: "selection.set", selection: { nodeIds: ["A", "B"], edgeIds: [], subgraphIds: [], primaryId: "B" }, source: "pointer" }
    ]);
  });

  it("turns blank pointer up with an existing selection into clear-selection command", () => {
    const state: InteractionState = {
      kind: "pendingBlankPointer",
      pointerId: 0,
      startScreen: { x: 100, y: 100 },
      startWorld: { x: 100, y: 100 },
      startedAt: 1000,
      selectionVersion: 1
    };
    const result = resolveCanvasPointerUp(pointer({ phase: "up", hit: { kind: "blank" } }), context({ nodeIds: ["A"], edgeIds: [], subgraphIds: [], primaryId: "A" }), {
      state,
      selectionVersion: 1,
      interactionGeneration: 1,
      now: 1000
    });

    expect(result.editorCommands).toEqual([{ type: "selection.clear", source: "pointer" }]);
    expect(result.localEffects).toEqual([{ type: "interaction.reset" }]);
  });

  it("turns blank double-click resolution into a local add-node request", () => {
    const state: InteractionState = {
      kind: "pendingBlankPointer",
      pointerId: 0,
      startScreen: { x: 100, y: 100 },
      startWorld: { x: 100, y: 100 },
      startedAt: 1000,
      selectionVersion: 1
    };
    const result = resolveCanvasPointerUp(pointer({ phase: "up", hit: { kind: "blank" } }), context(), {
      state,
      previousBlankClick: {
        target: "blank",
        pointerId: 0,
        screen: { x: 100, y: 100 },
        world: { x: 100, y: 100 },
        time: 1000,
        selectionVersion: 1,
        interactionGeneration: 1
      },
      selectionVersion: 1,
      interactionGeneration: 1,
      now: 1200
    });

    expect(result.localEffects).toEqual([
      { type: "graph.resolveAddNodeAt", point: { x: 100, y: 100 } },
      { type: "blankClick.invalidate" },
      { type: "interaction.reset" }
    ]);
  });

  it("turns double-click on an edge into selection plus local inline edit", () => {
    const result = resolveCanvasPointerDoubleClick(pointer({ phase: "double-click", hit: { kind: "edge", id: "A_B" } }), context());

    expect(result.editorCommands).toEqual([
      { type: "selection.set", selection: { nodeIds: [], edgeIds: ["A_B"], subgraphIds: [], primaryId: "A_B" }, source: "pointer" }
    ]);
    expect(result.localEffects).toEqual([
      { type: "blankClick.invalidate" },
      { type: "inlineEdit.start", target: { type: "edge", id: "A_B" } }
    ]);
  });

  it("turns double-click on a subgraph title into selection plus local inline edit", () => {
    const result = resolveCanvasPointerDoubleClick(pointer({ phase: "double-click", hit: { kind: "subgraphTitle", id: "Group" } }), context());

    expect(result.editorCommands).toEqual([
      { type: "selection.set", selection: { nodeIds: [], edgeIds: [], subgraphIds: ["Group"], primaryId: "Group" }, source: "pointer" }
    ]);
    expect(result.localEffects).toEqual([
      { type: "blankClick.invalidate" },
      { type: "inlineEdit.start", target: { type: "subgraph", id: "Group" } }
    ]);
  });

  it("turns drag threshold crossing into a local drag-start effect", () => {
    const state: InteractionState = {
      kind: "pendingNodePointer",
      nodeId: "A",
      pointerId: 0,
      startScreen: { x: 100, y: 100 },
      startWorld: { x: 100, y: 100 },
      startedAt: 1000,
      selectionVersion: 1
    };
    const result = resolveCanvasPointerMove(pointer({ phase: "move", screen: { x: 110, y: 100 }, world: { x: 110, y: 100 } }), context(), {
      state,
      selectionVersion: 1
    });

    expect(result.state).toMatchObject({ kind: "draggingNodes", nodeId: "A" });
    expect(result.localEffects).toEqual([{ type: "blankClick.invalidate" }, { type: "drag.startNode", nodeId: "A" }]);
  });

  it("turns completed connection state into a local connection resolver effect", () => {
    const state: InteractionState = {
      kind: "connectingEdge",
      pointerId: 0,
      fromId: "A",
      startWorld: { x: 0, y: 0 },
      currentWorld: { x: 200, y: 0 }
    };
    const result = resolveCanvasPointerUp(pointer({ phase: "up", hit: { kind: "node", id: "B" }, world: { x: 200, y: 0 } }), context(), {
      state,
      selectionVersion: 1,
      interactionGeneration: 1,
      now: 1100
    });

    expect(result.localEffects).toEqual([
      { type: "edge.resolveConnection", draft: state },
      { type: "blankClick.invalidate" },
      { type: "interaction.reset" }
    ]);
  });
});
