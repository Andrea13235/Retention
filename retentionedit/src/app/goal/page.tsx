"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Scissors,
  Layers,
  Film,
  Camera,
  ArrowRight,
  CheckCircle2,
  Clock,
  ChevronDown,
  BarChart3,
  Sliders,
} from "lucide-react";
import { Brand } from "@/components/brand";

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function GoalPage() {
  // Interactive ROI Calculator State
  const [hoursRecorded, setHoursRecorded] = useState<number>(6); // hours of raw video per month
  const [hourlyRate, setHourlyRate] = useState<number>(45); // estimated cost/value of creator's time per hour

  // Dynamic calculations based on industry averages (1 hr raw = ~5 hrs manual editing)
  const manualEditingHours = Math.round(hoursRecorded * 5);
  const retentionEditHours = Math.round((hoursRecorded * 0.25) * 10) / 10;
  const hoursSaved = Math.max(1, manualEditingHours - Math.round(retentionEditHours));
  const moneySaved = Math.round(hoursSaved * hourlyRate);

  // Active FAQ accordion state
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const goalFaqs = [
    {
      q: "Qual è l'obiettivo della startup RetentionEdit?",
      a: "L'obiettivo di RetentionEdit è eliminare completamente la barriera del montaggio video. Vogliamo che qualsiasi creator, freelance o azienda possa passare da un video RAW grezzo (o più riprese separate) ad un video finito, rifinito e di livello professionale, senza dover passare 15 ore davanti a software complessi come Premiere Pro.",
    },
    {
      q: "Cosa significa lo slogan 'RAW to Perfect'?",
      a: "'RAW to Perfect' riassume la nostra promessa: puoi registrare in modo naturale, senza preoccuparti di errori, pause o retakes. L'AI taglia i silenzi a 0ms, calibra il ritmo, armonizza l'audio e inserisce B-Roll 4K cinematografici con Higgsfield AI, consegnandoti un video master completo ed editato a regola d'arte.",
    },
    {
      q: "Il servizio crea clip o monta video interi?",
      a: "RetentionEdit è un software di montaggio video completo. Prende i tuoi video RAW grezzi (singoli o multipli) e li trasforma in un unico video perfettamente editato e pronto per la pubblicazione su YouTube e altri canali.",
    },
    {
      q: "Come interviene Higgsfield AI?",
      a: "Higgsfield crea immagini fotografiche 4K ad altissima risoluzione che vengono poi animate in 2.5D (Ken Burns & Camera Drift), garantendo nitidezza cristallina senza le deformazioni o lentezze tipiche del video AI generativo.",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR (EXACT OPUS.PRO MONOCHROME STYLE)                   */}
      {/* ========================================================================= */}
      <nav className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-[#1b1c24] px-6 lg:px-12 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="cursor-pointer">
            <Brand />
          </Link>

          <div className="hidden md:flex items-center gap-6 text-[13px] font-medium text-[#8c8f9f]">
            <Link href="/" className="hover:text-white transition-colors cursor-pointer">
              Home
            </Link>
            <a href="#problem" className="hover:text-white transition-colors cursor-pointer">
              Il Problema
            </a>
            <a href="#solution" className="hover:text-white transition-colors cursor-pointer">
              RAW to Perfect
            </a>
            <a href="#calculator" className="hover:text-white transition-colors cursor-pointer">
              Calcolatore ROI
            </a>
            <a href="#roadmap" className="hover:text-white transition-colors cursor-pointer">
              Roadmap
            </a>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="text-[13px] font-semibold text-[#8c8f9f] hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/?action=studio"
            className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Sign up - It&apos;s FREE
          </Link>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION: STARTUP MISSION MANIFESTO                                */}
      {/* ========================================================================= */}
      <header className="pt-20 pb-16 px-6 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#14151b] border border-[#23242e] text-[11px] font-bold tracking-wider uppercase text-[#8c8f9f]">
          <span>OUR GOAL • STARTUP MANIFESTO</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08]">
          Eliminare la barriera dell&apos;editing. <br />
          Da RAW a Perfetto per ogni creator.
        </h1>

        <p className="text-base sm:text-lg text-[#8c8f9f] max-w-3xl mx-auto leading-relaxed">
          Crediamo che il valore di un creator risieda nelle sue idee e nella sua autenticità, non nelle 15 ore spese a tagliare silenzi a mano su una timeline. La nostra missione è automatizzare completamente l&apos;editing video: trasformare qualsiasi ripresa RAW grezza in un video finito e professionale di livello studio.
        </p>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/?action=studio"
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all shadow-md active:scale-95"
          >
            Inizia gratis (25 crediti inclusi)
          </Link>

          <a
            href="#calculator"
            className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-[#1b1c24] hover:bg-[#252631] border border-[#2b2d3b] text-white text-xs font-semibold transition"
          >
            Calcola quanto tempo risparmi
          </a>
        </div>

        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-[#6f7283]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-white" /> Nessuna carta di credito richiesta
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-white" /> Zero watermark
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-white" /> Higgsfield 4K AI incluso
          </span>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. THE PROBLEM WE SOLVE                                                   */}
      {/* ========================================================================= */}
      <section id="problem" className="py-20 px-6 max-w-6xl mx-auto border-t border-[#181922] space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8c8f9f]">
            IL PROBLEMA REALE
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Perché il montaggio manuale frena i creator
          </h2>
          <p className="text-sm text-[#8c8f9f] max-w-2xl mx-auto">
            Ogni settimana milioni di video RAW rimangono salvati sull&apos;hard disk e non vedono mai la luce per colpa della fatica del montaggio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-3xl bg-[#121319] border border-[#21232d] shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#181924] border border-[#282a39] flex items-center justify-center text-white font-black text-xl">
              80%
            </div>
            <h3 className="text-lg font-bold text-white">Fatica da Timeline</h3>
            <p className="text-xs text-[#8c8f9f] leading-relaxed">
              L&apos;80% del tempo speso su un video se ne va in operazioni meccaniche: tagliare respiri, sincronizzare tracce audio, eliminare pause e cercare stock footage.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-[#121319] border border-[#21232d] shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#181924] border border-[#282a39] flex items-center justify-center text-white font-black text-xl">
              10x
            </div>
            <h3 className="text-lg font-bold text-white">Lentezza Produttiva</h3>
            <p className="text-xs text-[#8c8f9f] leading-relaxed">
              Montare a mano 10 minuti di video richiede dalle 5 alle 10 ore di lavoro. Questo rallenta la frequenza di pubblicazione e blocca la crescita dei canali.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-[#121319] border border-[#21232d] shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#181924] border border-[#282a39] flex items-center justify-center text-white font-black text-xl">
              €€€
            </div>
            <h3 className="text-lg font-bold text-white">Costi Inaccessibili</h3>
            <p className="text-xs text-[#8c8f9f] leading-relaxed">
              Delegare ad agenzie o montatori freelance costa dai €1.000 ai €3.000 al mese, una cifra proibitiva per la maggior parte dei solopreneur e creator indipendenti.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. THE SOLUTION: RAW TO PERFECT                                           */}
      {/* ========================================================================= */}
      <section id="solution" className="py-20 px-6 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8c8f9f]">
            LA SOLUZIONE
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            La formula &ldquo;RAW to Perfect&rdquo;
          </h2>
          <p className="text-sm text-[#8c8f9f] max-w-2xl mx-auto">
            RetentionEdit unisce l&apos;analisi vocale deterministica, il montaggio ritmico e la cinematografia generativa di Higgsfield AI in una pipeline 100% autonoma.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-[#121319] border border-[#21232d] space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-[#181924] border border-[#282a39] flex items-center justify-center text-white">
              <Scissors size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">
              Da 1 video RAW a 1 video editato
            </h3>
            <p className="text-xs sm:text-sm text-[#8c8f9f] leading-relaxed">
              Carica la tua registrazione grezza. L&apos;AI rileva ed elimina i silenzi a 0ms, taglia gli intercalari e le esitazioni, bilancia i livelli della voce ed esporta un video completo e rifinito.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-[#121319] border border-[#21232d] space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-[#181924] border border-[#282a39] flex items-center justify-center text-white">
              <Layers size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">
              Da più video RAW a 1 video editato
            </h3>
            <p className="text-xs sm:text-sm text-[#8c8f9f] leading-relaxed">
              Hai registrato più take o da telecamere diverse? La tecnologia Multi-RAW allinea i contenuti vocali, elimina i passaggi doppi e assembla tutto in una narrazione coerente e dinamica.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-[#121319] border border-[#21232d] space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-[#181924] border border-[#282a39] flex items-center justify-center text-white">
              <Film size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">
              Higgsfield AI Cinema Studio
            </h3>
            <p className="text-xs sm:text-sm text-[#8c8f9f] leading-relaxed">
              B-Roll 4K fotorealistici e movimenti di camera virtuali generati direttamente a partire dal tuo discorso. Niente più ore perse a cercare spezzoni video generici.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-[#121319] border border-[#21232d] space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-[#181924] border border-[#282a39] flex items-center justify-center text-white">
              <Camera size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">
              Esportazione Master 4K 60fps
            </h3>
            <p className="text-xs sm:text-sm text-[#8c8f9f] leading-relaxed">
              Renderizzazione ad altissima velocità su GPU serverless Nvidia, senza watermark e pronta per il caricamento su YouTube in alta qualità.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE ROI & SAVINGS CALCULATOR                                   */}
      {/* ========================================================================= */}
      <section id="calculator" className="py-20 px-6 max-w-5xl mx-auto">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#121319] border border-[#21232d] shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#181924] border border-[#282a39] text-white text-xs font-bold tracking-wider uppercase">
              <BarChart3 size={13} />
              <span>CALCOLATORE DI RISPARMIO</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Quanto tempo e denaro risparmi ogni mese?
            </h2>
            <p className="text-xs sm:text-sm text-[#8c8f9f] max-w-xl mx-auto">
              Sposta i cursori per visualizzare il tempo risparmiato montando i tuoi video RAW con RetentionEdit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="p-6 rounded-2xl bg-[#181924] border border-[#282a39] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Ore di video RAW registrate al mese:</span>
                <span className="px-3 py-1 rounded-lg bg-black text-white font-mono font-bold text-sm border border-[#2e303d]">
                  {hoursRecorded} ore
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={hoursRecorded}
                onChange={(e) => setHoursRecorded(Number(e.target.value))}
                className="w-full h-2 bg-[#222432] rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[11px] font-mono text-[#6f7283]">
                <span>1 ora</span>
                <span>15 ore</span>
                <span>30 ore</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#181924] border border-[#282a39] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Valore orario del tuo tempo:</span>
                <span className="px-3 py-1 rounded-lg bg-black text-white font-mono font-bold text-sm border border-[#2e303d]">
                  €{hourlyRate}/ora
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="150"
                step="5"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full h-2 bg-[#222432] rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[11px] font-mono text-[#6f7283]">
                <span>€20/h</span>
                <span>€75/h</span>
                <span>€150/h</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-5 rounded-2xl bg-[#0d0e14] border border-[#1f202c] text-center">
              <div className="text-[11px] text-[#8c8f9f] uppercase font-bold tracking-wider mb-1">
                Editing Manuale
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {manualEditingHours}h
              </div>
              <div className="text-[10px] text-[#6f7283] mt-1">Tempo perso a mano</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0d0e14] border border-[#1f202c] text-center">
              <div className="text-[11px] text-[#8c8f9f] uppercase font-bold tracking-wider mb-1">
                Con RetentionEdit
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {retentionEditHours}h
              </div>
              <div className="text-[10px] text-[#6f7283] mt-1">100% in autonomia</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0d0e14] border border-[#2e303d] text-center">
              <div className="text-[11px] text-[#8c8f9f] uppercase font-bold tracking-wider mb-1">
                Ore Risparmiate
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                +{hoursSaved}h
              </div>
              <div className="text-[10px] text-[#8c8f9f] mt-1">Recuperate ogni mese</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0d0e14] border border-[#1f202c] text-center">
              <div className="text-[11px] text-[#8c8f9f] uppercase font-bold tracking-wider mb-1">
                Valore Risparmiato
              </div>
              <div
                className="text-2xl sm:text-3xl font-black text-white"
                suppressHydrationWarning
              >
                €{formatNumber(moneySaved)}
              </div>
              <div className="text-[10px] text-[#6f7283] mt-1">Risparmio stimato/mese</div>
            </div>
          </div>

          <div className="pt-4 text-center">
            <Link
              href="/?action=studio"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-xs shadow-md transition"
            >
              <span>Inizia a montare gratis (25 crediti)</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. FAQ SECTION                                                            */}
      {/* ========================================================================= */}
      <section className="py-20 px-6 max-w-4xl mx-auto space-y-8 border-t border-[#181922]">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-white">Domande Frequenti sul Servizio</h2>
          <p className="text-xs text-[#8c8f9f]">Chiarimenti sul nostro servizio di editing autonomo da RAW a perfetto</p>
        </div>

        <div className="space-y-3">
          {goalFaqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#121319] border border-[#21232d] overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm font-bold text-white hover:text-white transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={16}
                    className={`text-[#8c8f9f] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-[#8c8f9f] leading-relaxed border-t border-[#1b1c25] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. FOOTER                                                                 */}
      {/* ========================================================================= */}
      <footer className="border-t border-[#1b1c24] py-12 px-6 lg:px-12 text-[#646777] text-xs flex flex-col sm:flex-row items-center justify-between gap-6 pb-24">
        <div className="flex items-center gap-3">
          <Brand compact />
          <span>&copy; 2026 RetentionEdit. All rights reserved. Slogan &ldquo;RAW to Perfect&rdquo;™.</span>
        </div>
        <div className="flex items-center gap-6 text-[#8c8f9f]">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <a href="#problem" className="hover:text-white transition">Il Problema</a>
          <a href="#calculator" className="hover:text-white transition">Calcolatore ROI</a>
          <Link href="/login" className="hover:text-white transition">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
