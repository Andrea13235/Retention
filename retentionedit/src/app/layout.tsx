import type { Metadata } from "next";
import "./globals.css";
import "@/styles/landing.css";
import "@/styles/studio.css";
import { AuthProvider } from "@/context/auth-context";

export const metadata: Metadata = {
  title: "RetentionEdit — Autonomous AI Video Editor",
  description:
    "Autonomous AI Video Editor powered by Open-Source Retention skill, Native RetentionVolt blueprints, and Modal GPU Serverless",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="dark" translate="no" suppressHydrationWarning style={{ backgroundColor: "#08080a", color: "#ffffff" }}>
      <body className="antialiased bg-black text-white min-h-screen" style={{ backgroundColor: "#08080a", color: "#ffffff" }} suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
