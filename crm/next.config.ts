import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Il limite predefinito e' 1 MB: un archivio da qualche migliaio di
    // clienti lo supera, e l'importazione fallirebbe senza spiegare perche'.
    serverActions: { bodySizeLimit: "32mb" },
  },
};

export default nextConfig;
