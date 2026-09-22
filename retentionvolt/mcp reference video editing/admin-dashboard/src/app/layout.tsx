import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RETENTIONVOLT Admin',
  description: 'Dashboard admin privata',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="bg-[#0a0a0f] text-slate-200 min-h-screen">
        {children}
      </body>
    </html>
  );
}
