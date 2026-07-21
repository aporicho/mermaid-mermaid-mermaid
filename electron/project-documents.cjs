const fsp = require("node:fs/promises");
const path = require("node:path");

async function createProjectDocument(request) {
  if (request?.documentKind !== "markdown") throw new Error("Only Markdown project documents can be created from the canvas.");
  const rootPath = await fsp.realpath(String(request?.rootPath || ""));
  const fileName = String(request?.fileName || "").trim();
  if (!fileName || fileName !== path.basename(fileName) || !/\.(?:md|markdown)$/i.test(fileName)) {
    throw new Error("Markdown document name must be a plain .md or .markdown file name.");
  }

  const filePath = path.join(rootPath, fileName);
  const file = { name: fileName, path: filePath };
  const text = typeof request?.text === "string" ? request.text : "";
  try {
    await fsp.writeFile(filePath, text, { encoding: "utf8", flag: "wx" });
    return { status: "created", file, text };
  } catch (error) {
    if (error?.code === "EEXIST") return { status: "exists", file };
    throw error;
  }
}

async function createProjectTextFile(request) {
  if (request?.kind !== "csv") throw new Error("Only CSV project text files are supported.");
  const rootPath = await fsp.realpath(String(request?.rootPath || ""));
  const fileName = String(request?.fileName || "").trim();
  if (!fileName || fileName !== path.basename(fileName) || !/\.csv$/i.test(fileName)) {
    throw new Error("CSV file name must be a plain .csv file name.");
  }

  const filePath = path.join(rootPath, fileName);
  const file = { name: fileName, path: filePath };
  const text = typeof request?.text === "string" ? request.text : "";
  if (Buffer.byteLength(text, "utf8") > 1_048_576) throw new Error("CSV file cannot exceed 1048576 bytes.");
  try {
    await fsp.writeFile(filePath, text, { encoding: "utf8", flag: "wx" });
    return { status: "created", file, text };
  } catch (error) {
    if (error?.code === "EEXIST") return { status: "exists", file };
    throw error;
  }
}

module.exports = {
  createProjectDocument,
  createProjectTextFile
};
