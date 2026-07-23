function normalizeHttpUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeEmbeddedBrowserUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    if (url.protocol !== "file:" || (url.hostname && url.hostname !== "localhost")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

module.exports = { normalizeEmbeddedBrowserUrl, normalizeHttpUrl };
