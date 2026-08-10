import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";

export type RuntimeAgentSessionTarget =
  | { kind: "new"; sessionId: string }
  | { kind: "existing"; sessionId: string; sessionPath: string };

export type RuntimeAgentStartRequest = {
  agentInstanceId: string;
  target: RuntimeAgentSessionTarget;
  cwd?: string;
  projectRoot?: string;
};

export type RuntimeAgentSessionSummary = {
  path: string;
  id: string;
  cwd: string;
  name?: string;
  parentSessionPath?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
};

export type RuntimeAgentInstanceStatus = "starting" | "idle" | "running" | "waiting" | "error";

export type RuntimeAgentInstanceSummary = {
  agentInstanceId: string;
  sessionId: string;
  sessionFile?: string;
  cwd: string;
  projectRoot?: string;
  status: RuntimeAgentInstanceStatus;
  foreground: boolean;
};
export type RuntimeAgentState = {
  cwd: string;
  scratch: boolean;
  sessionFile?: string;
  sessionId: string;
  diagnostics?: Array<{ type: "info" | "warning" | "error"; message: string }>;
};

export type RuntimeAgentStartResult = {
  status: "starting" | "ready" | "unsupported";
  instanceStatus?: RuntimeAgentInstanceStatus;
  state?: RuntimeAgentState | null;
  message?: string;
};

export type RuntimeAgentRpcCommand = {
  agentInstanceId?: string;
  id?: string;
  type: string;
  [key: string]: unknown;
};

export type RuntimeAgentRpcResponse = {
  accepted: boolean;
  id: string;
};

export type RuntimeAgentControlCommand = {
  agentInstanceId?: string;
  type: string;
  [key: string]: unknown;
};

export type RuntimeAgentEvent =
  | { agentInstanceId?: string; lane: "rpc"; payload: Record<string, unknown> }
  | { agentInstanceId?: string; lane: "control"; payload: Record<string, unknown> }
  | { agentInstanceId: string; lane: "lifecycle"; payload: { status: RuntimeAgentInstanceStatus | "dormant"; sessionId?: string; sessionFile?: string; reason?: string } }
  | { agentInstanceId?: string; lane: "host"; payload: RuntimeAgentHostRequest }
  | { agentInstanceId?: string; lane: "diagnostic"; payload: { level: "info" | "warning" | "error"; message: string } };

export type RuntimeAgentHostRequest = {
  id: string;
  method: "trust" | "auth_prompt" | "confirm" | "document.list" | "document.read" | "document.apply" | "document.reveal" | string;
  params?: Record<string, unknown>;
};

export type RuntimeAgentHostResponse = {
  agentInstanceId?: string;
  id: string;
  result?: unknown;
  error?: string;
};

export type RuntimeAgentExtensionUiResponse = {
  agentInstanceId?: string;
  id: string;
  confirmed?: boolean;
  value?: string;
  cancelled?: boolean;
};

export type RuntimeAgentTextSelection = {
  kind: "text" | "markdown";
  start: number;
  end: number;
  text: string;
  surroundingText?: string;
};

export type RuntimeAgentReference =
  | { kind: "file"; documentId?: string; path: string; label: string }
  | { kind: "text" | "markdown"; documentId: string; start: number; end: number; text: string; revision: string }
  | { kind: "mermaid-node" | "mermaid-edge" | "mermaid-subgraph"; documentId: string; id: string; label: string; revision: string }
  | { kind: "canvas-element"; documentId: string; id: string; elementType: string; label: string; revision: string };

export type RuntimeAgentDocumentSummary = {
  documentId: string;
  kind: DocumentKind;
  title: string;
  path?: string;
  revision: string;
  dirty: boolean;
  active: boolean;
  selection?: RuntimeAgentTextSelection | null;
  references?: RuntimeAgentReference[];
};

export type RuntimeAgentDocumentSnapshot = RuntimeAgentDocumentSummary & {
  content: string;
};

export type RuntimeAgentDocumentBridge = {
  list: () => Promise<{ documents: RuntimeAgentDocumentSummary[]; activeDocumentId?: string; projectRoot?: string }>;
  read: (documentId: string) => Promise<RuntimeAgentDocumentSnapshot>;
  apply: (request: Record<string, unknown>) => Promise<unknown>;
  reveal: (request: Record<string, unknown>) => Promise<unknown>;
};

export type RuntimeAgentOperations = {
  startAgent: (request: RuntimeAgentStartRequest) => Promise<RuntimeAgentStartResult>;
  listAgentSessions: (request: { cwd?: string }) => Promise<RuntimeAgentSessionSummary[]>;
  listAgentInstances: () => Promise<RuntimeAgentInstanceSummary[]>;
  setAgentInstanceForeground: (agentInstanceId: string, foreground: boolean) => Promise<void>;
  deleteAgentSession: (request: { sessionId: string; sessionPath: string }) => Promise<void>;
  sendAgentRpc: (command: RuntimeAgentRpcCommand) => Promise<RuntimeAgentRpcResponse>;
  runAgentControl: <T = unknown>(command: RuntimeAgentControlCommand) => Promise<T>;
  respondAgentExtensionUi: (response: RuntimeAgentExtensionUiResponse) => Promise<void>;
  respondAgentHost: (response: RuntimeAgentHostResponse) => Promise<void>;
  stopAgent: (agentInstanceId?: string) => Promise<void>;
  listenForAgentEvents: (handler: (event: RuntimeAgentEvent) => void) => Promise<() => void>;
};
