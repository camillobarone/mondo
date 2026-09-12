import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 e' un modulo nativo e non va impacchettato; nodemailer fa
  // richieste dinamiche che il compilatore non sa seguire, e impacchettarlo
  // rompe l'invio delle email di recupero.
  serverExternalPackages: ["better-sqlite3", "nodemailer"],
  experimental: {
    // Il limite predefinito e' 1 MB: un archivio da qualche migliaio di
    // clienti lo supera, e l'importazione fallirebbe senza spiegare perche'.
    serverActions: { bodySizeLimit: "32mb" },
  },
};

export default nextConfig;
