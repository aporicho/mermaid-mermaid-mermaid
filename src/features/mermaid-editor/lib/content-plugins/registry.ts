import { xiaohongshuPlugin } from "@/features/mermaid-editor/lib/content-plugins/xiaohongshu";

import type { CanvasContentPlugin, PluginCardDraft, PluginResolveContext } from "./types";

export const canvasContentPlugins: CanvasContentPlugin[] = [xiaohongshuPlugin];

export async function resolveContentPluginCardsFromText(text: string, context: PluginResolveContext): Promise<PluginCardDraft[]> {
  const matches = canvasContentPlugins.flatMap((plugin) => plugin.matchText(text));
  if (!matches.length) return [];

  const pluginsById = new Map(canvasContentPlugins.map((plugin) => [plugin.id, plugin]));
  const uniqueMatches = uniquePluginMatches(matches);
  const drafts: PluginCardDraft[] = [];

  for (const match of uniqueMatches) {
    const plugin = pluginsById.get(match.pluginId);
    if (!plugin) continue;
    drafts.push(await plugin.resolve(match, context));
  }

  return drafts;
}

function uniquePluginMatches(matches: ReturnType<CanvasContentPlugin["matchText"]>) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.pluginId}:${match.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type { CanvasContentPlugin, PluginCardDraft, PluginPasteMatch, PluginResolveContext } from "./types";
