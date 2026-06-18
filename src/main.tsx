import React from "react";
import { createRoot } from "react-dom/client";

import "@fontsource-variable/noto-sans-sc";
import "@fontsource/maple-mono/400.css";
import "@/styles/globals.css";
import { App } from "@/App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
