import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent IA Comptable & Patrimoine",
  description:
    "Interface chat dédiée aux questions comptables, fiscales, financières et patrimoniales.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        {children}
      </body>
    </html>
  );
}
