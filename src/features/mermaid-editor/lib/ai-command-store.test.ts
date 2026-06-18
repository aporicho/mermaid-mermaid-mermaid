import { afterEach, describe, expect, it } from "vitest";

import { clearAiCommands, getAiCommandResult, setAiCommandResult, submitAiApplyCommand, takeNextAiCommand } from "@/features/mermaid-editor/lib/ai-command-store";

afterEach(() => {
  clearAiCommands();
});

describe("AI command store", () => {
  it("queues apply commands and returns them once", () => {
    const command = submitAiApplyCommand({
      ops: [{ type: "updateNode", id: "A", label: "Alpha" }],
      targetFileName: "demo.mmd",
      autoSave: true,
      now: new Date("2026-06-17T00:00:00.000Z")
    });

    expect(command).toMatchObject({
      type: "applyPatch",
      targetFileName: "demo.mmd",
      autoSave: true
    });
    expect(takeNextAiCommand(new Date("2026-06-17T00:00:01.000Z"))?.id).toBe(command.id);
    expect(takeNextAiCommand(new Date("2026-06-17T00:00:02.000Z"))).toBeUndefined();
  });

  it("drops expired commands before the editor can take them", () => {
    submitAiApplyCommand({
      ops: [{ type: "updateNode", id: "A", label: "Alpha" }],
      now: new Date("2026-06-17T00:00:00.000Z"),
      ttlMs: 100
    });

    expect(takeNextAiCommand(new Date("2026-06-17T00:00:01.000Z"))).toBeUndefined();
  });

  it("stores command results for CLI polling", () => {
    setAiCommandResult("cmd_1", {
      commandId: "cmd_1",
      applied: true,
      saved: true,
      changed: true,
      fileName: "demo.mmd",
      diagnostics: []
    });

    expect(getAiCommandResult("cmd_1")).toMatchObject({
      applied: true,
      saved: true,
      fileName: "demo.mmd"
    });
  });
});
