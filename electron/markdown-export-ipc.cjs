const path = require("node:path");
const { exportMarkdownFolder } = require("./markdown-export.cjs");

function registerMarkdownExportIpc({ ipcMain, dialog, BrowserWindow, documentHub }) {
  ipcMain.handle("mmm:markdown:export-folder", async (event, request) => {
    const sourcePath = typeof request?.sourcePath === "string" ? request.sourcePath : "";
    try {
      const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender) ?? undefined, {
        title: "导出 Markdown 文档与资源",
        defaultPath: sourcePath ? path.dirname(sourcePath) : undefined,
        buttonLabel: "导出到这里",
        properties: ["openDirectory", "createDirectory"]
      });
      if (result.canceled || !result.filePaths[0]) return { status: "cancelled" };
      const workingCopy = documentHub.get({ path: sourcePath });
      return await exportMarkdownFolder({
        sourcePath,
        projectRoot: request?.projectRoot,
        documentText: typeof request?.documentText === "string" ? request.documentText : workingCopy?.content,
        parentDirectory: result.filePaths[0]
      });
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : String(error) };
    }
  });
}

module.exports = { registerMarkdownExportIpc };
