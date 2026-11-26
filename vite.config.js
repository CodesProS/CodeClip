import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project at https://<user>.github.io/CodeClip/,
  // so production builds need that sub-path. Local dev stays at '/'.
  base: command === "build" ? "/CodeClip/" : "/",
  plugins: [react()],
  // The code runner is a module worker that lazily imports the Python runtime.
  worker: { format: "es" },
}));
