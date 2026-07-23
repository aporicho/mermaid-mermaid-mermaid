import { hexToHslTriplet, hexToRgba, isHexColor } from "./color";
import type { CssBorderStyle, InterfaceThemeTokens, ShadowTokens } from "./appearance-types";
import type { EditorTypographyTokens, TypographyRoleTokens } from "./typography-types";

export type AgentSurfaceTokens = {
  background: string;
  foreground: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: CssBorderStyle;
  radius: number;
  shadow: ShadowTokens;
  paddingX: number;
  paddingY: number;
};

export type AgentThemeTokens = {
  layout: {
    sidebarWidth: number;
    transcriptMaxWidth: number;
    composerMaxWidth: number;
    contentPaddingX: number;
    contentPaddingY: number;
    turnGap: number;
    partGap: number;
  };
  typography: {
    body: TypographyRoleTokens;
    heading: TypographyRoleTokens;
    metadata: TypographyRoleTokens;
    technical: TypographyRoleTokens;
  };
  message: {
    user: AgentSurfaceTokens;
    assistant: AgentSurfaceTokens;
    notice: AgentSurfaceTokens;
    metadataForeground: string;
  };
  composer: AgentSurfaceTokens & {
    placeholder: string;
    minHeight: number;
    maxHeight: number;
  };
  tool: AgentSurfaceTokens & {
    mutedForeground: string;
    errorForeground: string;
    rowGap: number;
  };
  thinking: {
    foreground: string;
    accentColor: string;
    opacity: number;
  };
};

type AgentThemeSource = {
  interface: InterfaceThemeTokens;
  typography: EditorTypographyTokens;
};

export function createDefaultAgentTheme(source: AgentThemeSource): AgentThemeTokens {
  const colors = source.interface.colors;
  const noShadow = shadow(colors.foreground, 0, 0, 0);
  const baseSurface = {
    foreground: colors.foreground,
    borderColor: colors.border,
    borderWidth: 0,
    borderStyle: "none" as const,
    radius: source.interface.radius.controlLg,
    shadow: noShadow,
    paddingX: 14,
    paddingY: 10
  };

  return {
    layout: {
      sidebarWidth: 248,
      transcriptMaxWidth: 760,
      composerMaxWidth: 760,
      contentPaddingX: 24,
      contentPaddingY: 24,
      turnGap: 24,
      partGap: 8
    },
    typography: {
      body: { ...source.typography.interface.body },
      heading: { ...source.typography.interface.heading },
      metadata: { ...source.typography.interface.metadata },
      technical: { ...source.typography.interface.technical }
    },
    message: {
      user: { ...baseSurface, background: colors.muted, radius: 14 },
      assistant: {
        ...baseSurface,
        background: colors.card,
        radius: 0,
        paddingX: 0,
        paddingY: 0
      },
      notice: {
        ...baseSurface,
        background: colors.muted,
        foreground: colors.mutedForeground,
        borderWidth: source.interface.surface.borderWidth,
        borderStyle: source.interface.surface.borderStyle,
        radius: source.interface.radius.controlMd,
        paddingX: 12,
        paddingY: 9
      },
      metadataForeground: colors.mutedForeground
    },
    composer: {
      ...baseSurface,
      background: colors.card,
      borderColor: colors.input,
      borderWidth: source.interface.surface.borderWidth,
      borderStyle: source.interface.surface.borderStyle,
      radius: 16,
      shadow: { ...source.interface.shadow.toolbar, opacity: source.interface.shadow.toolbar.opacity * 0.72 },
      paddingX: 12,
      paddingY: 10,
      placeholder: colors.mutedForeground,
      minHeight: 72,
      maxHeight: 176
    },
    tool: {
      ...baseSurface,
      background: colors.muted,
      foreground: colors.foreground,
      borderColor: colors.border,
      borderWidth: source.interface.surface.borderWidth,
      borderStyle: source.interface.surface.borderStyle,
      radius: source.interface.radius.controlLg,
      paddingX: 12,
      paddingY: 10,
      mutedForeground: colors.mutedForeground,
      errorForeground: colors.destructive,
      rowGap: 8
    },
    thinking: {
      foreground: colors.mutedForeground,
      accentColor: colors.border,
      opacity: 0.86
    }
  };
}

export function normalizeAgentTheme(raw: unknown, fallback: AgentThemeTokens): AgentThemeTokens {
  const normalized = normalizeTree(raw, fallback) as AgentThemeTokens;
  const surfaces: Array<[AgentSurfaceTokens, AgentSurfaceTokens]> = [
    [normalized.message.user, fallback.message.user],
    [normalized.message.assistant, fallback.message.assistant],
    [normalized.message.notice, fallback.message.notice],
    [normalized.composer, fallback.composer],
    [normalized.tool, fallback.tool]
  ];
  for (const [surface, surfaceFallback] of surfaces) {
    surface.borderStyle = cssBorderStyle(surface.borderStyle, surfaceFallback.borderStyle);
    surface.shadow.opacity = clamp(surface.shadow.opacity, 0, 1);
  }
  normalized.thinking.opacity = clamp(normalized.thinking.opacity, 0, 1);
  return normalized;
}

export function agentToCssVariables(agent: AgentThemeTokens): Record<string, string> {
  const result: Record<string, string> = {
    "--agent-sidebar-width": px(agent.layout.sidebarWidth),
    "--agent-transcript-max-width": px(agent.layout.transcriptMaxWidth),
    "--agent-composer-max-width": px(agent.layout.composerMaxWidth),
    "--agent-content-padding-x": px(agent.layout.contentPaddingX),
    "--agent-content-padding-y": px(agent.layout.contentPaddingY),
    "--agent-turn-gap": px(agent.layout.turnGap),
    "--agent-part-gap": px(agent.layout.partGap),
    "--agent-message-metadata-foreground": hsl(agent.message.metadataForeground),
    "--agent-composer-placeholder": hsl(agent.composer.placeholder),
    "--agent-composer-min-height": px(agent.composer.minHeight),
    "--agent-composer-max-height": px(agent.composer.maxHeight),
    "--agent-tool-muted-foreground": hsl(agent.tool.mutedForeground),
    "--agent-tool-error-foreground": hsl(agent.tool.errorForeground),
    "--agent-tool-row-gap": px(agent.tool.rowGap),
    "--agent-thinking-foreground": hsl(agent.thinking.foreground),
    "--agent-thinking-accent": hsl(agent.thinking.accentColor),
    "--agent-thinking-opacity": `${agent.thinking.opacity}`
  };

  for (const [name, surface] of Object.entries({
    "message-user": agent.message.user,
    "message-assistant": agent.message.assistant,
    "message-notice": agent.message.notice,
    composer: agent.composer,
    tool: agent.tool
  })) Object.assign(result, surfaceVariables(name, surface));

  for (const [name, role] of Object.entries(agent.typography)) {
    result[`--agent-type-${name}-family`] = role.family;
    result[`--agent-type-${name}-size`] = px(role.fontSize);
    result[`--agent-type-${name}-weight`] = `${role.fontWeight}`;
    result[`--agent-type-${name}-line-height`] = px(role.lineHeight);
    result[`--agent-type-${name}-letter-spacing`] = px(role.letterSpacing);
  }
  return result;
}

function surfaceVariables(name: string, surface: AgentSurfaceTokens): Record<string, string> {
  return {
    [`--agent-${name}-background`]: hsl(surface.background),
    [`--agent-${name}-foreground`]: hsl(surface.foreground),
    [`--agent-${name}-border-color`]: hsl(surface.borderColor),
    [`--agent-${name}-border-width`]: px(surface.borderWidth),
    [`--agent-${name}-border-style`]: surface.borderStyle,
    [`--agent-${name}-radius`]: px(surface.radius),
    [`--agent-${name}-shadow`]: shadowCss(surface.shadow),
    [`--agent-${name}-padding-x`]: px(surface.paddingX),
    [`--agent-${name}-padding-y`]: px(surface.paddingY)
  };
}

function normalizeTree(raw: unknown, fallback: unknown): unknown {
  if (typeof fallback === "number") return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, raw) : fallback;
  if (typeof fallback === "string") {
    if (isHexColor(fallback)) return typeof raw === "string" && isHexColor(raw) ? raw : fallback;
    return typeof raw === "string" && raw.trim() ? raw : fallback;
  }
  if (!fallback || typeof fallback !== "object" || Array.isArray(fallback)) return fallback;
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(fallback as Record<string, unknown>).map(([key, value]) => [key, normalizeTree(source[key], value)]));
}

function cssBorderStyle(value: unknown, fallback: CssBorderStyle): CssBorderStyle {
  return value === "none" || value === "solid" || value === "dashed" || value === "dotted" || value === "double" ? value : fallback;
}

function shadow(color: string, blur: number, opacity: number, offsetY: number): ShadowTokens {
  return { color, blur, opacity, offsetX: 0, offsetY };
}

function shadowCss(value: ShadowTokens) {
  return `${value.offsetX}px ${value.offsetY}px ${value.blur}px ${hexToRgba(value.color, value.opacity)}`;
}

function hsl(value: string) {
  return hexToHslTriplet(value);
}

function px(value: number) {
  return `${value}px`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
