import type { RuntimeImageAssetResult } from "@/features/mermaid-editor/lib/editor-runtime";

export type ImageImportBatchInput<TSource> = {
  identity: string;
  source: TSource;
};

type ReadyImageAssetResult = Extract<RuntimeImageAssetResult, { status: "ready" }>;
type RejectedImageAssetResult = Exclude<RuntimeImageAssetResult, { status: "ready" }>;

export type ReadyImageImport<TSource> = ImageImportBatchInput<TSource> & {
  asset: ReadyImageAssetResult;
};

export type FailedImageImport<TSource> = ImageImportBatchInput<TSource> & {
  failure:
    | { kind: "result"; result: RejectedImageAssetResult }
    | { kind: "error"; error: unknown };
};

export type ImageImportBatchResult<TSource> = {
  ready: ReadyImageImport<TSource>[];
  failures: FailedImageImport<TSource>[];
};

/**
 * Imports all inputs concurrently, while keeping successful and failed results
 * in their original input order.
 */
export async function importImageBatch<TSource>(
  inputs: readonly ImageImportBatchInput<TSource>[],
  importer: (input: ImageImportBatchInput<TSource>) => Promise<RuntimeImageAssetResult>
): Promise<ImageImportBatchResult<TSource>> {
  const settled = await Promise.allSettled(inputs.map((input) => importer(input)));
  const ready: ReadyImageImport<TSource>[] = [];
  const failures: FailedImageImport<TSource>[] = [];

  settled.forEach((outcome, index) => {
    const input = inputs[index];
    if (outcome.status === "rejected") {
      failures.push({ ...input, failure: { kind: "error", error: outcome.reason } });
      return;
    }

    if (outcome.value.status === "ready") {
      ready.push({ ...input, asset: outcome.value });
      return;
    }

    failures.push({ ...input, failure: { kind: "result", result: outcome.value } });
  });

  return { ready, failures };
}
