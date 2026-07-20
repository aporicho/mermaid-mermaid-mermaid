// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useEditorThemeModel } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-theme-model";
import { loadInitialState } from "@/features/mermaid-editor/lib/editor-state";

type ThemeModel = ReturnType<typeof useEditorThemeModel>;

describe("useEditorThemeModel", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let model: ThemeModel | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<Probe onModel={(nextModel) => { model = nextModel; }} />));
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
    model = null;
  });

  it("keeps preview state separate from the committed theme until apply", () => {
    const committedThemeId = model?.themeId;

    act(() => {
      model?.beginThemeSettings();
      model?.previewTheme("minimal-mono", null);
    });
    expect(model?.themeId).toBe(committedThemeId);
    expect(model?.editingThemeId).toBe("minimal-mono");
    expect(model?.themeDraftDirty).toBe(true);

    act(() => model?.beginThemeSettings());
    expect(model?.editingThemeId).toBe("minimal-mono");

    act(() => model?.saveThemeSettings());
    expect(model?.themeId).toBe("minimal-mono");
    expect(model?.editingThemeId).toBe("minimal-mono");
    expect(model?.themeDraftDirty).toBe(false);
  });

  it("discards a session preview back to the committed theme", () => {
    const committedThemeId = model?.themeId;
    act(() => {
      model?.beginThemeSettings();
      model?.previewTheme("minimal-mono", null);
    });
    act(() => model?.discardThemeSettings());

    expect(model?.themeId).toBe(committedThemeId);
    expect(model?.editingThemeId).toBe(committedThemeId);
    expect(model?.themeDraftDirty).toBe(false);
  });

  function Probe({ onModel }: { onModel: (model: ThemeModel) => void }) {
    const nextModel = useEditorThemeModel({ initial: loadInitialState(), setStatus: () => undefined });
    onModel(nextModel);
    return null;
  }
});
