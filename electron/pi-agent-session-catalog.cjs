const path = require("node:path");

let sdkPromise;

async function listPiAgentSessions(cwd) {
  if (typeof cwd !== "string" || !cwd.trim()) return [];
  sdkPromise ||= import("@earendil-works/pi-coding-agent");
  const { SessionManager } = await sdkPromise;
  const sessions = await SessionManager.list(path.resolve(cwd));
  return sessions.map((session) => ({
    path: session.path,
    id: session.id,
    cwd: session.cwd,
    ...(session.name ? { name: session.name } : {}),
    ...(session.parentSessionPath ? { parentSessionPath: session.parentSessionPath } : {}),
    created: session.created.toISOString(),
    modified: session.modified.toISOString(),
    messageCount: session.messageCount,
    firstMessage: session.firstMessage
  }));
}

module.exports = { listPiAgentSessions };
