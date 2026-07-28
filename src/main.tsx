import React from "react";
import { createRoot } from "react-dom/client";

import "@fontsource-variable/noto-sans-sc";
import "@fontsource/maple-mono/400.css";
import "@/styles/globals.css";
import { App } from "@/App";
import { installAutoHidingScrollbars } from "@/lib/auto-hiding-scrollbars";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element.");
}

installAutoHidingScrollbars();

void renderApplication();

async function renderApplication() {
  let Component = App;
  if (import.meta.env.MODE === "e2e" && window.location.pathname === "/__e2e__/explorer") {
    Component = (await import("@/e2e/explorer-harness")).ExplorerE2EHarness;
  }
  if (import.meta.env.MODE === "e2e" && window.location.pathname === "/__e2e__/canvas-performance") {
    Component = (await import("@/e2e/canvas-performance-harness")).CanvasPerformanceE2EHarness;
  }

  createRoot(root!).render(
    <React.StrictMode>
      <Component />
    </React.StrictMode>
  );
}
