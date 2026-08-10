import type {
  RuntimeAgentControlCommand,
  RuntimeAgentEvent,
  RuntimeAgentExtensionUiResponse,
  RuntimeAgentHostResponse,
  RuntimeAgentRpcCommand,
  RuntimeAgentRpcResponse,
  RuntimeAgentInstanceSummary,
  RuntimeAgentSessionSummary,
  RuntimeAgentStartRequest,
  RuntimeAgentStartResult
} from "@/features/mermaid-editor/lib/editor-runtime/agent-types";

export type ElectronAgentBridge = {
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
  onAgentEvent: (handler: (event: RuntimeAgentEvent) => void) => () => void;
};
