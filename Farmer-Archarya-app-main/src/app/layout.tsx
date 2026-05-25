import type { Metadata, Viewport } from "next";
import { Newsreader, Geist, JetBrains_Mono, Hind_Siliguri, Hind } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-geist",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hind-siliguri",
  display: "swap",
});

const hind = Hind({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hind",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Farmer Acharya",
  description: "Practical farming mentor for crop learning, field questions, quizzes, and progress.",
  manifest: "/manifest.json",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#264E2E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = `${newsreader.variable} ${geist.variable} ${jetbrainsMono.variable} ${hindSiliguri.variable} ${hind.variable}`;
  return (
    <html lang="en" data-scroll-behavior="smooth" data-theme="light" className={`h-full ${fontVars}`} suppressHydrationWarning>
      <body className="h-full bg-paper text-ink font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
