// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMarkdownImageDropController,
  type MarkdownImageDropContext,
  type MarkdownImageDropTarget
} from "@/features/mermaid-editor/lib/markdown-image-drop";

const imageFile = { name: "photo.png", path: "/repo/assets/photo.png", relativePath: "assets/photo.png" };
const documentFile = { name: "notes.md", path: "/repo/notes.md", relativePath: "notes.md" };

function target(element: HTMLElement, overrides: Partial<MarkdownImageDropTarget> = {}) {
  return {
    element,
    documentFile,
    isEditable: vi.fn(() => true),
    preview: vi.fn<(context: MarkdownImageDropContext) => void>(),
    clearPreview: vi.fn(),
    insertAtClientPoint: vi.fn<(context: MarkdownImageDropContext) => void>(),
    ...overrides
  } satisfies MarkdownImageDropTarget;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("Markdown image drop targets", () => {
  it("routes to the deepest registered target under the browser's topmost hit", () => {
    const outerElement = document.createElement("section");
    const innerElement = document.createElement("article");
    const editorChild = document.createElement("p");
    innerElement.append(editorChild);
    outerElement.append(innerElement);
    document.body.append(outerElement);
    const outer = target(outerElement);
    const inner = target(innerElement, { documentFile: { ...documentFile, path: "/repo/inner.md" } });
    const controller = createMarkdownImageDropController(() => ({ elementFromPoint: () => editorChild }) as unknown as Document);
    controller.register(inner);
    controller.register(outer);

    const result = controller.route({ imageFile, point: { x: 40, y: 70 }, phase: "move" });

    expect(result).toEqual({ handled: true, target: inner });
    expect(inner.preview).toHaveBeenCalledWith({ imageFile, documentFile: inner.documentFile, point: { x: 40, y: 70 } });
    expect(outer.preview).not.toHaveBeenCalled();
  });

  it("only accepts the target containing elementFromPoint when panels overlap", () => {
    const lowerElement = document.createElement("section");
    const upperElement = document.createElement("section");
    const upperChild = document.createElement("div");
    upperElement.append(upperChild);
    document.body.append(lowerElement, upperElement);
    const lower = target(lowerElement);
    const upper = target(upperElement);
    const controller = createMarkdownImageDropController(() => ({ elementFromPoint: () => upperChild }) as unknown as Document);
    controller.register(lower);
    controller.register(upper);

    expect(controller.targetAtPoint({ x: 10, y: 10 })).toBe(upper);
  });

  it("clears the previous preview when crossing targets and inserts into the drop target", () => {
    const firstElement = document.createElement("section");
    const secondElement = document.createElement("section");
    document.body.append(firstElement, secondElement);
    let hit: Element = firstElement;
    const first = target(firstElement);
    const second = target(secondElement);
    const controller = createMarkdownImageDropController(() => ({ elementFromPoint: () => hit }) as unknown as Document);
    controller.register(first);
    controller.register(second);

    controller.route({ imageFile, point: { x: 10, y: 10 }, phase: "move" });
    hit = secondElement;
    controller.route({ imageFile, point: { x: 20, y: 20 }, phase: "move" });
    const result = controller.route({ imageFile, point: { x: 24, y: 28 }, phase: "drop" });

    expect(first.clearPreview).toHaveBeenCalledOnce();
    expect(second.clearPreview).toHaveBeenCalledOnce();
    expect(second.insertAtClientPoint).toHaveBeenCalledWith({ imageFile, documentFile, point: { x: 24, y: 28 } });
    expect(result.handled).toBe(true);
  });

  it("ignores read-only targets and clears an active preview on cancel or unregister", () => {
    const element = document.createElement("section");
    document.body.append(element);
    const editable = vi.fn(() => false);
    const registered = target(element, { isEditable: editable });
    const controller = createMarkdownImageDropController(() => ({ elementFromPoint: () => element }) as unknown as Document);
    const unregister = controller.register(registered);

    expect(controller.route({ imageFile, point: { x: 1, y: 1 }, phase: "move" }).handled).toBe(false);
    editable.mockReturnValue(true);
    expect(controller.route({ imageFile, point: { x: 1, y: 1 }, phase: "move" }).handled).toBe(true);
    expect(controller.route({ phase: "cancel" })).toEqual({ handled: true, target: registered });
    controller.route({ imageFile, point: { x: 1, y: 1 }, phase: "move" });
    unregister();

    expect(registered.clearPreview).toHaveBeenCalledTimes(2);
    expect(controller.targetAtPoint({ x: 1, y: 1 })).toBeNull();
  });
});
