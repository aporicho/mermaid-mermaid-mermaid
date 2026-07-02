const CLIPBOARD_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"] as const;

const CLIPBOARD_IMAGE_EXTENSIONS: Record<(typeof CLIPBOARD_IMAGE_TYPES)[number], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg"
};

export type ClipboardImageItem = {
  types: ReadonlyArray<string>;
  getType: (type: string) => Promise<Blob>;
};

export type ClipboardImageReadResult =
  | { status: "ready"; file: File }
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "error"; error: unknown };

export async function readClipboardImageFile(): Promise<ClipboardImageReadResult> {
  if (typeof navigator === "undefined" || typeof navigator.clipboard?.read !== "function") {
    return { status: "unavailable" };
  }

  try {
    const file = await imageFileFromClipboardItems(await navigator.clipboard.read());
    return file ? { status: "ready", file } : { status: "empty" };
  } catch (error) {
    return { status: "error", error };
  }
}

export async function imageFileFromClipboardItems(items: Iterable<ClipboardImageItem>) {
  for (const item of items) {
    const type = clipboardImageType(item);
    if (!type) continue;

    try {
      const blob = await item.getType(type);
      return new File([blob], `clipboard-image.${CLIPBOARD_IMAGE_EXTENSIONS[type]}`, {
        type: blob.type || type,
        lastModified: Date.now()
      });
    } catch {
      continue;
    }
  }

  return null;
}

function clipboardImageType(item: ClipboardImageItem): (typeof CLIPBOARD_IMAGE_TYPES)[number] | null {
  for (const type of CLIPBOARD_IMAGE_TYPES) {
    if (item.types.includes(type)) return type;
  }

  return null;
}
