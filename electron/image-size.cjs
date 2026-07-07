function previewImageExtension(contentType, url) {
  const normalizedType = String(contentType || "").toLowerCase();
  if (normalizedType.includes("image/png")) return "png";
  if (normalizedType.includes("image/jpeg") || normalizedType.includes("image/jpg")) return "jpg";
  if (normalizedType.includes("image/webp")) return "webp";
  if (normalizedType.includes("image/gif")) return "gif";

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const pathname = parsed.pathname.toLowerCase();
  if (pathname.endsWith(".png")) return "png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "jpg";
  if (pathname.endsWith(".webp")) return "webp";
  if (pathname.endsWith(".gif")) return "gif";

  const query = parsed.search.toLowerCase();
  if (query.includes("format=png")) return "png";
  if (query.includes("format=jpg") || query.includes("format=jpeg")) return "jpg";
  if (query.includes("format=webp")) return "webp";
  if (isXiaohongshuImageHost(parsed.hostname)) return "jpg";
  return null;
}

function readImageDimensions(contentType, input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const normalizedType = String(contentType || "").toLowerCase();
  if (normalizedType.includes("image/png") || bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return pngDimensions(bytes);
  }
  if (normalizedType.includes("image/jpeg") || normalizedType.includes("image/jpg") || bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))) {
    return jpegDimensions(bytes);
  }
  if (normalizedType.includes("image/webp") || bytes.subarray(0, 4).toString("ascii") === "RIFF") {
    return webpDimensions(bytes);
  }
  if (normalizedType.includes("image/gif") || bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a") {
    return gifDimensions(bytes);
  }
  return null;
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || bytes.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return nonzeroDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
}

function jpegDimensions(bytes) {
  if (!bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))) return null;
  let index = 2;
  while (index + 3 < bytes.length) {
    while (index < bytes.length && bytes[index] !== 0xff) index += 1;
    while (index < bytes.length && bytes[index] === 0xff) index += 1;
    if (index >= bytes.length) return null;

    const marker = bytes[index];
    index += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (index + 1 >= bytes.length) return null;

    const segmentLength = bytes.readUInt16BE(index);
    if (segmentLength < 2 || index + segmentLength > bytes.length) return null;
    if (isJpegSofMarker(marker) && segmentLength >= 7) {
      return nonzeroDimensions(bytes.readUInt16BE(index + 5), bytes.readUInt16BE(index + 3));
    }
    index += segmentLength;
  }
  return null;
}

function isJpegSofMarker(marker) {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}

function webpDimensions(bytes) {
  if (bytes.length < 30 || bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP") return null;
  const chunk = bytes.subarray(12, 16).toString("ascii");
  const data = bytes.subarray(20);
  if (chunk === "VP8X" && data.length >= 10) {
    return nonzeroDimensions(1 + data[4] + (data[5] << 8) + (data[6] << 16), 1 + data[7] + (data[8] << 8) + (data[9] << 16));
  }
  if (chunk === "VP8L" && data.length >= 5 && data[0] === 0x2f) {
    const width = 1 + (((data[2] & 0x3f) << 8) | data[1]);
    const height = 1 + (((data[4] & 0x0f) << 10) | (data[3] << 2) | ((data[2] & 0xc0) >> 6));
    return nonzeroDimensions(width, height);
  }
  if (chunk === "VP8 " && data.length >= 10 && data.subarray(3, 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
    return nonzeroDimensions(data.readUInt16LE(6) & 0x3fff, data.readUInt16LE(8) & 0x3fff);
  }
  return null;
}

function gifDimensions(bytes) {
  if (bytes.length < 10) return null;
  return nonzeroDimensions(bytes.readUInt16LE(6), bytes.readUInt16LE(8));
}

function nonzeroDimensions(width, height) {
  return width > 0 && height > 0 ? { width, height } : null;
}

function isXiaohongshuImageHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return (host.endsWith(".xhscdn.com") && (host.startsWith("sns-img") || host.startsWith("sns-webpic"))) || host === "ci.xiaohongshu.com" || host.endsWith(".ci.xiaohongshu.com");
}

module.exports = {
  previewImageExtension,
  readImageDimensions
};
