function createWindowFullscreenPreloadBridge(ipcRenderer) {
  return {
    getWindowFullscreen() {
      return ipcRenderer.invoke("mmm:window:is-fullscreen");
    },
    toggleWindowFullscreen() {
      return ipcRenderer.invoke("mmm:window:toggle-fullscreen");
    },
    onWindowFullscreenChange(handler) {
      const listener = (_event, fullscreen) => handler(Boolean(fullscreen));
      ipcRenderer.on("mmm:window:fullscreen-changed", listener);
      return () => ipcRenderer.removeListener("mmm:window:fullscreen-changed", listener);
    }
  };
}

module.exports = { createWindowFullscreenPreloadBridge };
