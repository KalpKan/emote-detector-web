import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    // MediaPipe's WASM runtime and the .task models are served as static files from public/, never bundled.
    target: "es2020",
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
