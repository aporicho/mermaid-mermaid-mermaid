const { getFonts2 } = require("font-list");

let fontCatalogPromise;

async function listSystemFonts() {
  fontCatalogPromise ??= getFonts2({ disableQuoting: true })
    .then(normalizeSystemFonts)
    .catch((error) => {
      console.warn("Unable to enumerate system fonts.", error);
      return [];
    });
  return fontCatalogPromise;
}

function normalizeSystemFonts(fonts) {
  const byFamily = new Map();
  for (const font of Array.isArray(fonts) ? fonts : []) {
    const family = sanitizeFamilyName(font?.familyName || font?.name);
    if (!family) continue;
    const key = family.normalize("NFKC").toLocaleLowerCase();
    const current = byFamily.get(key);
    if (current) {
      current.monospace = current.monospace || Boolean(font?.monospace);
      continue;
    }
    byFamily.set(key, { family, monospace: Boolean(font?.monospace) });
  }
  const collator = new Intl.Collator(["zh-CN", "en"], { sensitivity: "base", numeric: true });
  return [...byFamily.values()].sort((left, right) => collator.compare(left.family, right.family));
}

function sanitizeFamilyName(value) {
  if (typeof value !== "string") return "";
  const family = [...value.normalize("NFKC")].filter((character) => {
    const code = character.charCodeAt(0);
    return code > 31 && code !== 127;
  }).join("").trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  return family.slice(0, 256);
}

module.exports = { listSystemFonts, normalizeSystemFonts, sanitizeFamilyName };
