import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export function LegalShell({
  title,
  subtitle,
  updatedAt,
  children,
}: {
  title: string;
  subtitle: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#e5e5e5] selection:bg-[#d1fe17] selection:text-black">
      <header className="sticky top-0 z-30 border-b border-[#222] bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#8e8e8e] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Torna al sito
          </Link>
          <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#d1fe17]">
            <ShieldCheck className="w-4 h-4" />
            RETENTIONVOLT LEGAL
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="rounded-3xl border border-[#262626] bg-[#141414] overflow-hidden">
          <div className="px-6 sm:px-8 py-8 sm:py-10 border-b border-[#222] bg-[#171717]">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">{title}</h1>
            <p className="text-sm text-[#8e8e8e] mt-2 leading-relaxed max-w-3xl">{subtitle}</p>
            <p className="text-[11px] text-[#666] mt-3">Ultimo aggiornamento: {updatedAt} · Versione 1.0</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              <Link href="/privacy" className="px-3 py-1.5 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-white hover:bg-[#262626] transition-colors">Privacy</Link>
              <Link href="/cookies" className="px-3 py-1.5 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-white hover:bg-[#262626] transition-colors">Cookie</Link>
              <Link href="/terms" className="px-3 py-1.5 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-white hover:bg-[#262626] transition-colors">Termini</Link>
              <Link href="/legal-notice" className="px-3 py-1.5 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] text-white hover:bg-[#262626] transition-colors">Note legali</Link>
            </div>
          </div>
          <div className="px-6 sm:px-8 py-8 prose prose-invert max-w-none prose-headings:text-white prose-headings:font-bold prose-a:text-[#d1fe17] prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-li:marker:text-[#666] prose-p:text-[#a3a3a3] prose-p:leading-relaxed prose-li:text-[#a3a3a3] text-sm leading-relaxed">
            {children}
          </div>
        </div>
        <p className="text-[11px] text-[#555] text-center mt-6 px-4">
          Questo documento non costituisce consulenza legale. Per domande: <a href="mailto:support@retentionvolt.com" className="underline decoration-white/20 underline-offset-4 hover:text-white">support@retentionvolt.com</a>
        </p>
      </main>
    </div>
  );
}
