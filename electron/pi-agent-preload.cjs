function createPiAgentPreloadBridge(ipcRenderer) {
  return {
    startAgent(request) { return ipcRenderer.invoke("mmm:agent:start", request); },
    listAgentSessions(request) { return ipcRenderer.invoke("mmm:agent:list-sessions", request); },
    listAgentInstances() { return ipcRenderer.invoke("mmm:agent:list-instances"); },
    setAgentInstanceForeground(agentInstanceId, foreground) { return ipcRenderer.invoke("mmm:agent:set-foreground", { agentInstanceId, foreground }); },
    deleteAgentSession(request) { return ipcRenderer.invoke("mmm:agent:delete-session", request); },
    sendAgentRpc(command) { return ipcRenderer.invoke("mmm:agent:rpc", command); },
    runAgentControl(command) { return ipcRenderer.invoke("mmm:agent:control", command); },
    respondAgentExtensionUi(response) { return ipcRenderer.invoke("mmm:agent:extension-ui-response", response); },
    respondAgentHost(response) { return ipcRenderer.invoke("mmm:agent:host-response", response); },
    stopAgent(agentInstanceId) { return ipcRenderer.invoke("mmm:agent:stop", { agentInstanceId }); },
    onAgentEvent(handler) {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on("mmm:agent:event", listener);
      return () => ipcRenderer.removeListener("mmm:agent:event", listener);
    }
  };
}

module.exports = { createPiAgentPreloadBridge };
