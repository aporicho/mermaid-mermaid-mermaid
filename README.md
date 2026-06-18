# Mermaid Canvas Editor

A local Mermaid editor that combines source editing, rendered preview, and an editable infinite canvas for flowcharts.

The app is built with Vite, React, TypeScript, Tailwind CSS, shadcn-style UI primitives, Mermaid, React Konva, and Tauri for the installable desktop shell.

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

Prepare the app with the single primary command:

```bash
npm run ready
```

`npm run ready` runs tests, typecheck, production build, and then stays attached to the frontend dev service at:

```text
http://127.0.0.1:5173
```

If the project dev server is already running on port 5173, `npm run ready` temporarily stops it for verification and starts it again after checks pass. It never stops a non-project process.

Run `npm run ready` from a normal local shell and leave that command running when you need the web service to stay up. For the installable desktop shell, use `npm run desktop:dev`.

## Desktop And AI Bridge

The browser build is a static Vite app for human editing, viewing, importing, and exporting Mermaid files. The desktop build adds native file access and the live AI bridge.

Desktop commands:

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:ship
npm run windows:run
```

Use `npm run desktop:ship` after code changes when you want the full local desktop flow in one command. It runs tests and typecheck, builds the Tauri package, installs the current-platform artifact, and launches it. Set `MMM_SHIP_SKIP_CHECKS=1` when you only want a fast package/install/launch loop, or `MMM_SHIP_PACKAGE_ONLY=1` when you only want build artifacts.

Tauri builds for the operating system that runs the command. Running from WSL produces a Linux artifact; run the same command from Windows PowerShell/CMD when you need the Windows installer.

From WSL, use this as the one-command Windows acceptance loop:

```bash
npm run windows:run
```

It syncs the current workspace to a Windows temp staging directory, runs Windows `npm install`, builds the Windows Tauri package, installs it, and launches the desktop app. By default it skips the duplicate Windows-side test/typecheck pass because the normal repo checks should be run in WSL. Set `MMM_WINDOWS_RUN_FULL_CHECKS=1` to include those checks, or `MMM_WINDOWS_RUN_LAUNCH_ONLY=1` to only open the already installed Windows app.

When the desktop app starts, it opens a token-protected local bridge on a random `127.0.0.1` port and writes discovery metadata to:

```text
~/.mermaid-canvas-editor/bridge.json
```

The `mmm` CLI reads that file by default for live commands such as `mmm ping`, `mmm context`, and `mmm apply`. Static web builds intentionally do not expose live AI context.

## Canvas Navigation

- Drag nodes directly in select mode.
- Hold Space and drag, or use middle/right mouse drag, to pan temporarily.
- On a MacBook trackpad, use two-finger scroll to pan the infinite canvas and render view.
- Use pinch zoom in Safari, or Cmd/Ctrl + wheel, to zoom around the pointer.
- Shift + wheel scrolls horizontally when the input device does not provide horizontal delta.

## Health Checks

Use this as the default acceptance command before and after meaningful changes:

```bash
npm run ready
```

For local debugging only, the lower-level commands remain available:

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

Prefer `npm run ready` for final validation and hands-on browser testing. It handles project dev server restart automatically and keeps the app available by remaining attached to the Vite dev server after checks pass.
Prefer `npm run ready` for browser validation. Use `npm run desktop:dev` for Tauri validation.

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
src/main.tsx, src/App.tsx, src/styles/
  Vite React app entry and global styles.

src-tauri/
  Tauri desktop shell, native file commands, and local AI bridge.

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
- Browser and desktop platform behavior should go through `editor-runtime.ts`; editor components should not call Tauri APIs, browser file picker APIs, or AI bridge endpoints directly.
- New node IDs should use the `N1`, `N2`, `N3` sequence unless preserving user-provided IDs.
- UI icons should use Iconoir, matching the existing size, spacing, hover, and active patterns.

## Useful Files

- `src/features/mermaid-editor/components/mermaid-editor.tsx`: top-level editor state and commands.
- `src/features/mermaid-editor/components/konva-canvas.tsx`: Konva rendering and event bridge.
- `src/features/mermaid-editor/lib/editor-runtime.ts`: web/desktop runtime adapter for files, drafts, and AI bridge calls.
- `src/features/mermaid-editor/lib/mermaid-graph.ts`: Mermaid flowchart parse and serialize logic.
- `src/features/mermaid-editor/lib/mermaid-document.ts`: document load/build flow and canvas-layout handling.
- `src/features/mermaid-editor/lib/editor-types.ts`: shared editor data model.
