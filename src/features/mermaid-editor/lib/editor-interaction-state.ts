export type EditorCanvasSize = {
  width: number;
  height: number;
};

export type EditorRecentAction = {
  id: string;
  at: string;
  type: string;
  target?: {
    kind: "node" | "edge" | "subgraph" | "document" | "canvas" | "source";
    id?: string;
  };
  summary?: string;
};

export type EditorEditingContext =
  | { kind: "node"; id: string; draftText: string }
  | { kind: "edge"; id: string; draftText: string }
  | { kind: "subgraph"; id: string; draftText: string }
  | { kind: "source"; draftText: string };
