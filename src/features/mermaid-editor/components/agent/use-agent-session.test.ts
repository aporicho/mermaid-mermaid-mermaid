import { describe, expect, it } from "vitest";

import { normalizeAgentSessionState, normalizeAgentTranscript } from "./use-agent-session";

describe("normalizeAgentTranscript", () => {
  it("keeps messages and tool calls in transcript order while correlating results", () => {
    const transcript = normalizeAgentTranscript([
      { id: "user-1", role: "user", content: [{ type: "text", text: "检查项目" }] },
      {
        id: "assistant-1",
        role: "assistant",
        content: [
          { type: "thinking", thinking: "先读取文件" },
          { type: "text", text: "我先检查。" },
          { type: "toolCall", id: "call-1", name: "read", arguments: { path: "README.md" } }
        ]
      },
      { role: "toolResult", toolCallId: "call-1", content: [{ type: "text", text: "contents" }], isError: false },
      { id: "assistant-2", role: "assistant", content: [{ type: "text", text: "检查完成。" }] }
    ]);

    expect(transcript.map((item) => item.kind)).toEqual(["message", "message", "tool", "message"]);
    expect(transcript[1]).toMatchObject({ role: "assistant", text: "我先检查。", thinking: "先读取文件" });
    expect(transcript[2]).toMatchObject({
      kind: "tool",
      toolCallId: "call-1",
      name: "read",
      args: { path: "README.md" },
      status: "complete"
    });
  });

  it("retains orphaned tool results and notice messages instead of dropping history", () => {
    const transcript = normalizeAgentTranscript([
      { role: "toolResult", toolCallId: "orphan", toolName: "bash", details: { exitCode: 1 }, isError: true },
      { id: "notice", role: "system", message: "会话已压缩" }
    ]);

    expect(transcript).toMatchObject([
      { kind: "tool", name: "bash", status: "error", result: { exitCode: 1 } },
      { kind: "notice", text: "会话已压缩", tone: "neutral" }
    ]);
  });

  it("treats Pi's unknown model placeholder as an unconfigured model", () => {
    expect(normalizeAgentSessionState({ model: { id: "unknown", provider: "unknown" }, sessionId: "one" })).toMatchObject({
      model: null,
      sessionId: "one"
    });
    const configured = { id: "claude-sonnet", provider: "anthropic" };
    expect(normalizeAgentSessionState({ model: configured }).model).toBe(configured);
  });
});
