const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

async function writeJsonAtomically(filePath, value, mode = 0o600) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fsp.open(temporaryPath, "wx", mode);
    await handle.writeFile(JSON.stringify(value, null, 2), "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fsp.rename(temporaryPath, filePath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await fsp.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

module.exports = { writeJsonAtomically };
