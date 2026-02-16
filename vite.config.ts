import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/sitemap.xml': {
        target: 'https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/sitemap',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/sitemap-posts.xml': {
        target: 'https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/sitemap?type=posts',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/sitemap-wiki.xml': {
        target: 'https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/sitemap?type=wiki',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/sitemap-communities.xml': {
        target: 'https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/sitemap?type=communities',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/sitemap-events.xml': {
        target: 'https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/sitemap?type=events',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/sitemap-rankings.xml': {
        target: 'https://jguylowswwgjvotdcsfj.supabase.co/functions/v1/sitemap?type=rankings',
        changeOrigin: true,
        rewrite: () => '',
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent duplicate React instances
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@radix-ui/react-use-size', '@tanstack/react-query'],
  },
}));
