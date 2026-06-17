#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

import { Command } from "commander";

import {
  aiContextSchema,
  defaultAiServerUrl,
  diffMermaidDocuments,
  fetchAiEditorContext,
  layoutMermaidDocument,
  parseEdgeRouting,
  parseLayoutMode,
  parseTimeoutMs,
  patchMermaidDocument,
  pingAiEditorContext,
  readMermaidDocument,
  submitAiApplyCommand,
  validateMermaidDocument,
  type CliEnvelope
} from "@/cli/mermaid-cli-core";

const program = new Command();

program.name("mmm").description("AI-oriented Mermaid canvas CLI").version("0.1.0");

program
  .command("context")
  .description("Read the live WebUI editor context: selection, visible canvas, editing draft, recent actions, and diagnostics.")
  .option("--server <url>", `Editor server URL. Defaults to MMM_SERVER_URL or ${defaultAiServerUrl()}`)
  .option("--timeout <ms>", "Request timeout in milliseconds")
  .action(async (options: { server?: string; timeout?: string }) => {
    await run(async () => {
      const timeoutMs = parseTimeoutMs(options.timeout);
      if (options.timeout && !timeoutMs) return usageError("context", options.server, `无效 timeout：${options.timeout}`);
      return fetchAiEditorContext({ server: options.server, timeoutMs });
    });
  });

program
  .command("ping")
  .description("Check whether the WebUI editor context service is reachable.")
  .option("--server <url>", `Editor server URL. Defaults to MMM_SERVER_URL or ${defaultAiServerUrl()}`)
  .option("--timeout <ms>", "Request timeout in milliseconds")
  .action(async (options: { server?: string; timeout?: string }) => {
    await run(async () => {
      const timeoutMs = parseTimeoutMs(options.timeout);
      if (options.timeout && !timeoutMs) return usageError("ping", options.server, `无效 timeout：${options.timeout}`);
      return pingAiEditorContext({ server: options.server, timeoutMs });
    });
  });

program
  .command("schema")
  .description("Print the AI context command contract and example payload.")
  .action(async () => {
    await run(() => aiContextSchema());
  });

program
  .command("apply")
  .description("Apply structured JSON operations through the live WebUI editor session and wait for the result.")
  .requiredOption("--ops <file>", "JSON file containing an ops array, or an object with an ops array")
  .option("--target <fileName>", "Only apply when the open WebUI document filename matches")
  .option("--server <url>", `Editor server URL. Defaults to MMM_SERVER_URL or ${defaultAiServerUrl()}`)
  .option("--timeout <ms>", "End-to-end timeout in milliseconds")
  .option("--no-save", "Apply in WebUI without writing through the current file handle")
  .action(async (options: { ops: string; target?: string; server?: string; timeout?: string; save?: boolean }) => {
    await run(async () => {
      const timeoutMs = parseTimeoutMs(options.timeout);
      if (options.timeout && !timeoutMs) return usageError("apply", options.target, `无效 timeout：${options.timeout}`);
      return submitAiApplyCommand(await readJson(options.ops), {
        targetFileName: options.target,
        server: options.server,
        timeoutMs,
        autoSave: options.save !== false
      });
    });
  });

program
  .command("read")
  .description("Read a Mermaid document as the editor graph model.")
  .arguments("<file>")
  .action(async (file: string) => {
    await run(async () => readMermaidDocument(await readText(file), file));
  });

program
  .command("validate")
  .description("Validate Mermaid syntax with the official Mermaid parser.")
  .arguments("<file>")
  .action(async (file: string) => {
    await run(async () => validateMermaidDocument(await readText(file), file));
  });

program
  .command("diff")
  .description("Compare two Mermaid documents by graph semantics and canvas layout.")
  .arguments("<before> <after>")
  .action(async (before: string, after: string) => {
    await run(async () => diffMermaidDocuments(await readText(before), await readText(after), `${before}..${after}`));
  });

program
  .command("patch")
  .description("Apply structured JSON operations to a flowchart Mermaid document.")
  .arguments("<file>")
  .requiredOption("--ops <file>", "JSON file containing an ops array, or an object with an ops array")
  .option("--write", "Write the changed document back to the input file")
  .action(async (file: string, options: { ops: string; write?: boolean }) => {
    await run(async () => {
      const envelope = await patchMermaidDocument(await readText(file), await readJson(options.ops), { file, write: Boolean(options.write) });
      if (options.write && envelope.ok && envelope.result?.source) await writeFile(file, envelope.result.source, "utf8");
      return envelope;
    });
  });

program
  .command("layout")
  .description("Apply Dagre auto layout and update the canvas-layout metadata.")
  .arguments("<file>")
  .option("--routing <routing>", "straight | bezier | orthogonal | mermaid")
  .option("--mode <mode>", "manual | auto")
  .option("--write", "Write the changed document back to the input file")
  .action(async (file: string, options: { routing?: string; mode?: string; write?: boolean }) => {
    await run(async () => {
      const edgeRouting = parseEdgeRouting(options.routing);
      const layoutMode = parseLayoutMode(options.mode);
      if (options.routing && !edgeRouting) return usageError("layout", file, `不支持的 routing：${options.routing}`);
      if (options.mode && !layoutMode) return usageError("layout", file, `不支持的 mode：${options.mode}`);

      const envelope = await layoutMermaidDocument(await readText(file), {
        file,
        write: Boolean(options.write),
        edgeRouting,
        layoutMode
      });
      if (options.write && envelope.ok && envelope.result?.source) await writeFile(file, envelope.result.source, "utf8");
      return envelope;
    });
  });

program.parseAsync(process.argv).catch((error) => {
  emit(usageError("mmm", undefined, error instanceof Error ? error.message : String(error)));
  process.exitCode = 2;
});

async function run<T>(callback: () => Promise<CliEnvelope<T>> | CliEnvelope<T>) {
  try {
    const envelope = await callback();
    emit(envelope);
    process.exitCode = envelope.ok ? 0 : 1;
  } catch (error) {
    emit(usageError("mmm", undefined, error instanceof Error ? error.message : String(error)));
    process.exitCode = 2;
  }
}

async function readText(file: string) {
  return readFile(file, "utf8");
}

async function readJson(file: string) {
  return JSON.parse(await readText(file));
}

function emit(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usageError(command: string, file: string | undefined, message: string): CliEnvelope<never> {
  return {
    ok: false,
    command,
    file,
    diagnostics: [
      {
        id: `cli:USAGE_ERROR:${hashText(message)}`,
        severity: "error",
        source: "serializer",
        code: "USAGE_ERROR",
        message
      }
    ]
  };
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
