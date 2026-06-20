import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { siteOrigin, siteUrl } from "@/lib/site-url";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const preview = requestHeaders.get("x-sigj-preview") === "1";
  const pathname = requestHeaders.get("x-sigj-pathname") || "/";
  const canonical = siteUrl(pathname);
  const title = preview
    ? "Vista previa técnica | SIGJ"
    : "SIGJ | Sistema Integral de Gestión Judicial";
  const description = preview
    ? "Vista previa técnica del Sistema Integral de Gestión Judicial. El acceso se realiza únicamente desde el dominio oficial."
    : "Portal institucional del Sistema Integral de Gestión Judicial.";

  return {
    metadataBase: new URL(siteOrigin()),
    title: {
      default: title,
      template: preview ? "%s | Vista previa técnica · SIGJ" : "%s | SIGJ",
    },
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "es_CO",
      siteName: "SIGJ",
      title,
      description,
      url: canonical,
    },
    robots: preview
      ? {
          index: false,
          follow: false,
          noarchive: true,
          nosnippet: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : { index: true, follow: true },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
