import type { NextConfig } from "next";

/**
 * Due modalità di build:
 * - predefinita: app completa con server (API, database SQLite);
 * - NEXT_PUBLIC_STATIC_EXPORT=1: sito statico per GitHub Pages, con i dati nel
 *   browser. Restano fuori le API (route .ts) e le pagine con parametri
 *   dinamici (page.server.tsx); l'editor diventa /editor/?id=… (page.static.tsx).
 */
const isStatic = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isStatic
    ? {
        output: "export",
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
        trailingSlash: true,
        images: { unoptimized: true },
        pageExtensions: ["tsx", "static.tsx"],
      }
    : {
        serverExternalPackages: ["@libsql/client", "libsql", "@prisma/adapter-libsql"],
        pageExtensions: ["tsx", "ts", "server.tsx"],
      }),
};

export default nextConfig;
