function createWindowFileRouter() {
  const filesByWebContentsId = new Map();

  function enqueue(webContentsId, files) {
    if (!Number.isInteger(webContentsId) || webContentsId < 0 || !Array.isArray(files)) return [];
    const pending = filesByWebContentsId.get(webContentsId) || [];

    for (const file of files) {
      if (!file || typeof file.path !== "string" || !file.path) continue;
      if (pending.some((item) => item.path === file.path)) continue;
      pending.push(file);
    }

    if (pending.length > 0) filesByWebContentsId.set(webContentsId, pending);
    return [...pending];
  }

  function take(webContentsId) {
    const pending = filesByWebContentsId.get(webContentsId) || [];
    filesByWebContentsId.delete(webContentsId);
    return [...pending];
  }

  function clear(webContentsId) {
    filesByWebContentsId.delete(webContentsId);
  }

  return { clear, enqueue, take };
}

module.exports = { createWindowFileRouter };
