# Mermaid Canvas Editor

A local Mermaid editor that combines source editing, rendered preview, and an editable infinite canvas for flowcharts.

The app is built with Next.js, React, TypeScript, Tailwind CSS, shadcn-style UI primitives, Mermaid, and React Konva.

## What It Does

- Edits Mermaid flowcharts on an infinite canvas.
- Keeps Mermaid source and the internal graph model in sync.
- Renders non-flowchart Mermaid diagrams in a preview-only mode.
- Stores canvas positions, node colors, edge routing, and viewport in a `%% canvas-layout:` comment.
- Supports file open, save, save as, download fallback, undo, redo, copy, paste, node editing, edge editing, connection creation, and endpoint retargeting.
- Applies editor themes across CSS variables, Konva canvas tokens, and Mermaid render variables.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the URL printed by Next.js, usually:

```text
http://localhost:3000
```

For a restart-friendly local debug server, use:

```bash
npm run debug
```

For terminal sessions that need to keep the server attached in the foreground, use:

```bash
npm run debug:fg
```

`npm run build` refuses to run while the default dev port is active, which prevents production builds from overwriting the live dev CSS or React manifests in `.next`.

## Canvas Navigation

- Drag nodes directly in select mode.
- Hold Space and drag, or use middle/right mouse drag, to pan temporarily.
- On a MacBook trackpad, use two-finger scroll to pan the infinite canvas and render view.
- Use pinch zoom in Safari, or Cmd/Ctrl + wheel, to zoom around the pointer.
- Shift + wheel scrolls horizontally when the input device does not provide horizontal delta.

## Health Checks

Run these before and after meaningful changes:

```bash
npm test
npm run typecheck
npm run build
```

The test suite focuses on the pure editor logic under `src/features/mermaid-editor/lib`.

## Mermaid Support Boundary

Flowcharts are editable on the infinite canvas. The internal model uses graph terms such as `node` and `edge`, while Mermaid source keeps Mermaid terms such as `id`, `label`, and `shape`.

Other Mermaid diagram types are treated as render-only:

- Sequence
- Class
- State
- ER
- Gantt
- Pie
- Mindmap
- Timeline
- Architecture
- Unknown Mermaid input

The flowchart parser is a lightweight project parser, not a complete Mermaid AST implementation. It supports the syntax covered by the tests and preserves unsupported statements where possible.

## Project Structure

```text
src/app/
  Next.js app entry and global styles.

src/components/ui/
  Shared UI primitives.

src/features/mermaid-editor/components/
  React UI, source panel, preview panel, inspector, toolbar, and Konva canvas bridge.

src/features/mermaid-editor/lib/
  Pure editor logic: parsing, serialization, layout, interaction state, hit targets,
  visual state, geometry, routing, diagnostics, history, and tests.

docs/
  Architecture and interaction constraints for future changes.
```

## Development Constraints

Follow the boundaries in `docs/interaction-design.md` and `docs/technical-constraints.md`.
For input latency and render throughput work, also follow `docs/performance-design.md`.

Key rules:

- `canvas-interaction.ts` owns the canvas interaction state machine.
- `canvas-hit-target.ts` owns conversion from Konva shapes to business hit targets.
- `canvas-visual-state.ts` owns visual state decisions for nodes, edges, anchors, drafts, guides, and selections.
- `node-geometry.ts` owns node frame, text, anchor, routing, alignment, and hit-test geometry.
- `edge-geometry.ts` owns completed and draft edge routing.
- Konva components should translate events, render shapes, and execute returned commands. They should not accumulate scattered business rules.
- New node IDs should use the `N1`, `N2`, `N3` sequence unless preserving user-provided IDs.
- UI icons should use Iconoir, matching the existing size, spacing, hover, and active patterns.

## Useful Files

- `src/features/mermaid-editor/components/mermaid-editor.tsx`: top-level editor state and commands.
- `src/features/mermaid-editor/components/konva-canvas.tsx`: Konva rendering and event bridge.
- `src/features/mermaid-editor/lib/mermaid-graph.ts`: Mermaid flowchart parse and serialize logic.
- `src/features/mermaid-editor/lib/mermaid-document.ts`: document load/build flow and canvas-layout handling.
- `src/features/mermaid-editor/lib/editor-types.ts`: shared editor data model.
