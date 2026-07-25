import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"]
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
