#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

import { Command } from "commander";

import {
  diffMermaidDocuments,
  layoutMermaidDocument,
  parseEdgeRouting,
  parseLayoutMode,
  patchMermaidDocument,
  readMermaidDocument,
  validateMermaidDocument,
  type CliEnvelope
} from "@/cli/mermaid-cli-core";
import { createPerformanceFixtureDocument, PERFORMANCE_FIXTURE_SIZES, type PerformanceFixtureSize } from "@/features/mermaid-editor/lib/performance-fixtures";

const program = new Command();

program.name("mmm").description("AI-oriented Mermaid canvas CLI").version("0.1.0");

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

program
  .command("fixture")
  .description("Generate a deterministic large Mermaid canvas performance fixture.")
  .option("--size <size>", "100 | 300 | 800", "100")
  .option("--out <file>", "Write the fixture Mermaid document to a file instead of printing it in the JSON result.")
  .action(async (options: { size?: string; out?: string }) => {
    await run(async () => {
      const size = parsePerformanceFixtureSize(options.size);
      if (!size) return usageError("fixture", options.out, `无效 size：${options.size}`);

      const source = createPerformanceFixtureDocument(size);
      if (options.out) await writeFile(options.out, source, "utf8");

      return {
        ok: true,
        command: "fixture",
        file: options.out,
        result: {
          size,
          written: Boolean(options.out),
          ...(options.out ? {} : { source })
        },
        diagnostics: []
      };
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

function parsePerformanceFixtureSize(value: string | undefined): PerformanceFixtureSize | null {
  const parsed = Number(value || 100);
  return PERFORMANCE_FIXTURE_SIZES.includes(parsed as PerformanceFixtureSize) ? (parsed as PerformanceFixtureSize) : null;
}
