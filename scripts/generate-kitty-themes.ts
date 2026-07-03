import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

type RepoConfig = {
  sourceId: string;
  sourceName: string;
  repository: string;
  url: string;
  repoLicense: string;
};

type ParsedTheme = {
  id: string;
  name: string;
  path: string;
  url: string;
  license: string;
  author?: string;
  upstream?: string;
  palette: Record<string, string>;
};

const repos: RepoConfig[] = [
  {
    sourceId: "dexpota",
    sourceName: "dexpota/kitty-themes",
    repository: "https://github.com/dexpota/kitty-themes",
    url: "https://github.com/dexpota/kitty-themes.git",
    repoLicense: "MIT"
  },
  {
    sourceId: "kovidgoyal",
    sourceName: "kovidgoyal/kitty-themes",
    repository: "https://github.com/kovidgoyal/kitty-themes",
    url: "https://github.com/kovidgoyal/kitty-themes.git",
    repoLicense: "GPL-3.0"
  }
];

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const themeRoot = join(projectRoot, "src/features/mermaid-editor/lib/editor-theme/themes");
const requiredKeys = ["background", "foreground", ...Array.from({ length: 16 }, (_, index) => `color${index}`)];

const generatedThemes: ParsedTheme[] = [];
const skipped: string[] = [];

for (const repo of repos) {
  const tempRoot = mkdtempSync(join(tmpdir(), `mmm-${repo.sourceId}-themes-`));
  const repoDir = join(tempRoot, "repo");
  const sourceOutDir = join(themeRoot, repo.sourceId);

  rmSync(sourceOutDir, { recursive: true, force: true });
  mkdirSync(sourceOutDir, { recursive: true });

  execFileSync("git", ["clone", "--depth", "1", repo.url, repoDir], { stdio: "inherit" });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" }).trim();
  const themeFiles = findThemeFiles(join(repoDir, "themes")).sort((a, b) => a.localeCompare(b));
  const usedIds = new Set<string>();

  for (const themeFile of themeFiles) {
    const sourcePath = relative(repoDir, themeFile).replaceAll("\\", "/");
    const parsed = parseKittyTheme(repo, themeFile, sourcePath, commit, usedIds);
    if (!parsed) continue;

    const definition = {
      kind: "kitty",
      id: parsed.id,
      name: parsed.name,
      description: `${parsed.name} kitty theme from ${repo.sourceName}.`,
      mode: inferMode(parsed.palette.background),
      source: {
        id: repo.sourceId,
        name: repo.sourceName,
        repository: repo.repository,
        path: parsed.path,
        url: parsed.url,
        commit,
        license: parsed.license,
        ...(parsed.author ? { author: parsed.author } : {}),
        ...(parsed.upstream ? { upstream: parsed.upstream } : {})
      },
      palette: {
        background: parsed.palette.background,
        foreground: parsed.palette.foreground,
        ...(parsed.palette.cursor ? { cursor: parsed.palette.cursor } : {}),
        ...(parsed.palette.cursor_text_color ? { cursorText: parsed.palette.cursor_text_color } : {}),
        ...(parsed.palette.selection_background ? { selectionBackground: parsed.palette.selection_background } : {}),
        ...(parsed.palette.selection_foreground ? { selectionForeground: parsed.palette.selection_foreground } : {}),
        ...Object.fromEntries(Array.from({ length: 16 }, (_, index) => [`color${index}`, parsed.palette[`color${index}`]]))
      }
    };

    writeFileSync(join(sourceOutDir, `${parsed.id.replace(`kitty-${repo.sourceId}-`, "")}.theme.json`), `${JSON.stringify(definition, null, 2)}\n`);
    generatedThemes.push(parsed);
  }

  rmSync(tempRoot, { recursive: true, force: true });
}

writeThirdPartyNotice();
console.log(`Generated ${generatedThemes.length} kitty themes. Skipped ${skipped.length}.`);

function parseKittyTheme(repo: RepoConfig, themeFile: string, sourcePath: string, commit: string, usedIds: Set<string>): ParsedTheme | null {
  const source = readFileSync(themeFile, "utf8");
  const metadata = parseMetadata(source);
  const palette = parsePalette(source);
  const missing = requiredKeys.filter((key) => !palette[key]);

  if (missing.length) {
    skipped.push(`${repo.sourceName}/${sourcePath}: missing ${missing.join(", ")}`);
    return null;
  }

  const fileName = basename(themeFile).replace(/\.conf$/i, "");
  const slug = uniqueSlug(slugify(fileName), usedIds);
  const url = `${repo.repository}/blob/${commit}/${sourcePath}`;

  return {
    id: `kitty-${repo.sourceId}-${slug}`,
    name: metadata.name ?? humanizeName(fileName),
    path: sourcePath,
    url,
    license: metadata.license ?? repo.repoLicense,
    author: metadata.author,
    upstream: metadata.upstream,
    palette
  };
}

function parseMetadata(source: string) {
  const metadata: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*#+\s*([a-z0-9_-]+):\s*(.+?)\s*$/i);
    if (!match) continue;
    metadata[match[1].toLowerCase()] = match[2].trim();
  }
  return {
    name: metadata.name,
    author: metadata.author,
    license: metadata.license,
    upstream: metadata.upstream
  };
}

function parsePalette(source: string) {
  const rawPalette: Record<string, string> = {};
  const palette: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([a-z0-9_-]+)\s+(?:=\s*)?(.+?)\s*$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    rawPalette[key] = match[2].trim().split(/\s+/)[0];
  }

  for (const [key, rawValue] of Object.entries(rawPalette)) {
    const color = normalizeColor(rawValue);
    if (color) palette[key] = color;
  }

  for (const [key, rawValue] of Object.entries(rawPalette)) {
    if ((rawValue === "background" || rawValue === "foreground") && palette[rawValue]) palette[key] = palette[rawValue];
  }
  return palette;
}

function normalizeColor(value: string) {
  const hex = value.trim();
  const short = hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : null;
}

function findThemeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return findThemeFiles(path);
    return entry.endsWith(".conf") ? [path] : [];
  });
}

function uniqueSlug(slug: string, usedIds: Set<string>) {
  let next = slug || "theme";
  let suffix = 2;
  while (usedIds.has(next)) next = `${slug}-${suffix++}`;
  usedIds.add(next);
  return next;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function humanizeName(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function inferMode(background: string) {
  return contrast(background, "#000000") > contrast(background, "#ffffff") ? "light" : "dark";
}

function contrast(a: string, b: string) {
  const aLum = luminance(hexToRgb(a));
  const bLum = luminance(hexToRgb(b));
  const lighter = Math.max(aLum, bLum);
  const darker = Math.min(aLum, bLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(rgb: { r: number; g: number; b: number }) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(value: string) {
  const normalized = value.slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function writeThirdPartyNotice() {
  const lines = [
    "# Third Party Themes",
    "",
    "This file is generated by `npm run themes:generate`.",
    "",
    `Generated themes: ${generatedThemes.length}`,
    `Skipped themes: ${skipped.length}`,
    "",
    "| Theme | Source | License | Author | File |",
    "| --- | --- | --- | --- | --- |",
    ...generatedThemes
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((theme) => `| ${escapeTable(theme.name)} | ${escapeTable(theme.id)} | ${escapeTable(theme.license)} | ${escapeTable(theme.author ?? "")} | ${escapeTable(theme.url)} |`)
  ];

  if (skipped.length) {
    lines.push("", "## Skipped", "", ...skipped.map((item) => `- ${item}`));
  }

  writeFileSync(join(projectRoot, "THIRD_PARTY_THEMES.md"), `${lines.join("\n")}\n`);
}

function escapeTable(value: string) {
  return value.replaceAll("|", "\\|");
}
