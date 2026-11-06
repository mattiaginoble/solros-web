import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Narrow } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const archivoNarrow = Archivo_Narrow({
  variable: "--font-archivo-narrow",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Configuratore Casa",
  description: "Disegna la tua casa stanza per stanza, arredala con prodotti reali e ottieni un preventivo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f3f6f4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${archivo.variable} ${archivoNarrow.variable} h-full`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
