import type {
  RuntimeAgentControlCommand,
  RuntimeAgentEvent,
  RuntimeAgentExtensionUiResponse,
  RuntimeAgentHostResponse,
  RuntimeAgentRpcCommand,
  RuntimeAgentRpcResponse,
  RuntimeAgentStartRequest,
  RuntimeAgentStartResult
} from "@/features/mermaid-editor/lib/editor-runtime/agent-types";

export type ElectronAgentBridge = {
  startAgent: (request: RuntimeAgentStartRequest) => Promise<RuntimeAgentStartResult>;
  sendAgentRpc: (command: RuntimeAgentRpcCommand) => Promise<RuntimeAgentRpcResponse>;
  runAgentControl: <T = unknown>(command: RuntimeAgentControlCommand) => Promise<T>;
  respondAgentExtensionUi: (response: RuntimeAgentExtensionUiResponse) => Promise<void>;
  respondAgentHost: (response: RuntimeAgentHostResponse) => Promise<void>;
  stopAgent: () => Promise<void>;
  onAgentEvent: (handler: (event: RuntimeAgentEvent) => void) => () => void;
};
