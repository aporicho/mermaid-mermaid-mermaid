import type { RuntimeAgentInstanceStatus, RuntimeAgentSessionSummary } from "@/features/mermaid-editor/lib/editor-runtime";

export type AgentWorkspaceSessionStatus = RuntimeAgentInstanceStatus | "dormant";

export type AgentWorkspaceActivity = { running: number; waiting: number; errors: number; unread: number };

export type AgentWorkspaceSession = RuntimeAgentSessionSummary & {
  status: AgentWorkspaceSessionStatus;
  unread: boolean;
  live: boolean;
  error?: string;
};

export type AgentWorkspaceController = {
  sessions: AgentWorkspaceSession[];
  activeSessionId: string | null;
  catalogBusy: boolean;
  createSession: () => void;
  activateSession: (session: AgentWorkspaceSession) => void;
  refreshSessions: () => Promise<void>;
  deleteSession: (session: AgentWorkspaceSession) => Promise<void>;
};
