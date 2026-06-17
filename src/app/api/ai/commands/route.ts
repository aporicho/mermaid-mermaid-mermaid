import { NextResponse } from "next/server";

import { aiCommandDiagnostic, submitAiApplyCommand } from "@/features/mermaid-editor/lib/ai-command-store";
import type { PatchOperation } from "@/features/mermaid-editor/lib/mermaid-patch";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isApplyPatchRequest(body)) {
      return NextResponse.json(
        {
          ok: false,
          diagnostics: [aiCommandDiagnostic("INVALID_COMMAND", "命令格式无效。", "请求体需要包含 type: applyPatch 和 ops 数组。")]
        },
        { status: 400 }
      );
    }

    const command = submitAiApplyCommand({
      ops: body.ops,
      targetFileName: typeof body.targetFileName === "string" ? body.targetFileName : undefined,
      autoSave: body.autoSave !== false
    });

    return NextResponse.json({ ok: true, command, diagnostics: [] });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        diagnostics: [aiCommandDiagnostic("INVALID_JSON", "请求体不是有效的 JSON。")]
      },
      { status: 400 }
    );
  }
}

function isApplyPatchRequest(value: unknown): value is { type: "applyPatch"; ops: PatchOperation[]; targetFileName?: unknown; autoSave?: unknown } {
  if (!value || typeof value !== "object") return false;
  const body = value as { type?: unknown; ops?: unknown };
  return body.type === "applyPatch" && Array.isArray(body.ops);
}
