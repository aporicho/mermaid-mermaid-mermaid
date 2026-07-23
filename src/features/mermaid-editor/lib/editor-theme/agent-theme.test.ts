import { describe, expect, it } from "vitest";

import {
  compileEditorTheme,
  createDefaultAgentTheme,
  DEFAULT_EDITOR_THEME,
  normalizeAgentTheme,
  normalizeEditorTheme
} from "@/features/mermaid-editor/lib/editor-theme";

describe("Agent theme", () => {
  it("compiles every Agent surface and layout group to CSS variables", () => {
    const compiled = compileEditorTheme(DEFAULT_EDITOR_THEME);

    expect(DEFAULT_EDITOR_THEME.version).toBe(12);
    expect(compiled.agent).toEqual(DEFAULT_EDITOR_THEME.agent);
    expect(compiled.cssVariables).toMatchObject({
      "--agent-sidebar-width": "248px",
      "--agent-transcript-max-width": "760px",
      "--agent-message-user-background": expect.any(String),
      "--agent-message-assistant-border-style": "none",
      "--agent-composer-min-height": "72px",
      "--agent-tool-error-foreground": expect.any(String),
      "--agent-thinking-opacity": "0.86"
    });
  });

  it("normalizes invalid partial overrides without coupling neighboring surfaces", () => {
    const fallback = createDefaultAgentTheme(DEFAULT_EDITOR_THEME);
    const normalized = normalizeAgentTheme({
      message: {
        user: { background: "#123456", borderStyle: "zigzag", radius: -8 },
        assistant: { background: "invalid" }
      },
      composer: { shadow: { opacity: 4 } },
      thinking: { opacity: 9 }
    }, fallback);

    expect(normalized.message.user).toMatchObject({
      background: "#123456",
      borderStyle: fallback.message.user.borderStyle,
      radius: 0
    });
    expect(normalized.message.assistant.background).toBe(fallback.message.assistant.background);
    expect(normalized.composer.shadow.opacity).toBe(1);
    expect(normalized.thinking.opacity).toBe(1);
  });

  it("migrates older themes by deriving Agent defaults from their own palette and typography", () => {
    const migrated = normalizeEditorTheme({
      version: 11,
      interface: {
        colors: {
          background: "#ffffff",
          foreground: "#111111",
          card: "#ffffff",
          muted: "#eeeeee",
          border: "#999999",
          input: "#999999"
        }
      }
    });

    expect(migrated.version).toBe(12);
    expect(migrated.agent.message.assistant.background).toBe("#ffffff");
    expect(migrated.agent.message.user.background).toBe("#eeeeee");
    expect(migrated.agent.composer.borderColor).toBe("#999999");
    expect(migrated.agent.typography.body).toEqual(migrated.typography.interface.body);
  });
});
