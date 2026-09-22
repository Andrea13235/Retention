import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CookieBanner } from "@/components/CookieBanner";
import { VisitBeacon } from "@/components/VisitBeacon";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "RETENTIONVOLT — Video Editing & Motion Design Intelligence",
  description: "Reverse-engineer the editing DNA, cuts per minute, motion graphics, and thumbnails of top-performing YouTube and short-form creators.",
  keywords: ["video editing reference", "retention intelligence", "mcp server", "video cuts database", "motion graphics database"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#0e0e0e] text-white min-h-screen antialiased selection:bg-white selection:text-black font-sans">
        <AuthProvider>
          {children}
          <CookieBanner />
          <VisitBeacon />
        </AuthProvider>
      </body>
    </html>
  );
}
