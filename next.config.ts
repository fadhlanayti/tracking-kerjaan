import type { NextConfig } from "next";

function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    "localhost:3000",
    "localhost:3005",
    "127.0.0.1:3000",
    "127.0.0.1:3005",
  ]);

  for (const key of ["NEXTAUTH_URL", "APP_URL"]) {
    const val = process.env[key];
    if (val) {
      try {
        origins.add(new URL(val).host);
      } catch {
        origins.add(val.replace(/^https?:\/\//, "").split("/")[0]);
      }
    }
  }

  if (process.env.ALLOWED_ORIGINS) {
    for (const item of process.env.ALLOWED_ORIGINS.split(",")) {
      const trimmed = item.trim();
      if (trimmed) origins.add(trimmed.replace(/^https?:\/\//, "").split("/")[0]);
    }
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins(),
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
