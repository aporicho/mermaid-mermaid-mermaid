import { NextResponse } from "next/server";

import { takeNextAiCommand } from "@/features/mermaid-editor/lib/ai-command-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    command: takeNextAiCommand(),
    diagnostics: []
  });
}
