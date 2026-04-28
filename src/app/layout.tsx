import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Bungee } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-main",
});

const bungee = Bungee({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Viewtopia — Track Movies, TV Series & Anime",
  description: "Track what you watch with friends. Movies, TV series, and anime — all in one place.",
  icons: {
    icon: "/favicon.svg",
  },
};

// Explicit viewport so iOS Safari renders at correct device-width and respects
// the notch / safe areas. `maximumScale: 5` keeps native pinch-to-zoom for
// accessibility (don't lock to 1).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#050208",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${bungee.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
