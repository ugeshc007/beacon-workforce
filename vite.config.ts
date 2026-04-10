import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  // @ts-ignore - lovable-tagger is only available in Lovable sandbox
  let tagger: any;
  if (mode === "development") {
    try {
      tagger = (await import(/* @vite-ignore */ "lovable-tagger")).componentTagger;
    } catch {
      // lovable-tagger not available outside Lovable sandbox
    }
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), tagger?.()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
