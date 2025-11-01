import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  publicDir: resolve(__dirname, "public"),
  build: {
    outDir: resolve(__dirname, "../dist/dashboard/app"),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    fs: {
      allow: [resolve(__dirname, ".."), resolve(__dirname, "../dist/dashboard")],
    },
  },
});
