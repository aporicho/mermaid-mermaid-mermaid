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
  const Component = import.meta.env.MODE === "e2e" && window.location.pathname === "/__e2e__/explorer"
    ? (await import("@/e2e/explorer-harness")).ExplorerE2EHarness
    : App;

  createRoot(root!).render(
    <React.StrictMode>
      <Component />
    </React.StrictMode>
  );
}
