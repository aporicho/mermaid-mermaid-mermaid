function registerWindowFullscreenIpc({ ipcMain, BrowserWindow }) {
  ipcMain.handle("mmm:window:is-fullscreen", (event) => {
    return Boolean(BrowserWindow.fromWebContents(event.sender)?.isFullScreen());
  });
  ipcMain.handle("mmm:window:toggle-fullscreen", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    const fullscreen = !window.isFullScreen();
    window.setFullScreen(fullscreen);
    return fullscreen;
  });
}

function attachWindowFullscreenEvents(window) {
  const sendState = () => {
    if (!window.isDestroyed()) window.webContents.send("mmm:window:fullscreen-changed", window.isFullScreen());
  };
  window.on("enter-full-screen", sendState);
  window.on("leave-full-screen", sendState);
}

module.exports = { attachWindowFullscreenEvents, registerWindowFullscreenIpc };
