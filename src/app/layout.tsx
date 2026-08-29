import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "U.S. Department of Justice", template: "%s | U.S. Department of Justice" },
  description: "Portal institucional de servicios, Federal Cases, DOJ Matters, comunicados y hearings.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
