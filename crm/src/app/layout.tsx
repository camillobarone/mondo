import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mondo Immobiliare — Gestione clienti",
  description: "Gestionale clienti e portafoglio immobili di Mondo Immobiliare Lecce.",
  robots: { index: false, follow: false },
  // Il manifest serve agli avvisi sul telefono, non a fare un'app: senza, un
  // iPhone non lascia nemmeno aggiungere il gestionale alla schermata Home, e
  // senza quel passaggio Apple le notifiche non le manda affatto.
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Gestionale", statusBarStyle: "default" },
  icons: {
    icon: "/icona-192.png",
    apple: "/icona-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f5154",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
