"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface ToastEventDetail {
  message: string;
  duration?: number;
}

export function showToast(message: string, duration = 3000) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>("retentionedit:toast", {
      detail: { message, duration },
    })
  );
}

export function ToastContainer() {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastEventDetail>;
      const message = customEvent.detail?.message;
      if (!message) return;

      const id = Date.now();
      setToast({ message, id });

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, customEvent.detail?.duration || 3200);
    };

    window.addEventListener("retentionedit:toast", handleToast);
    return () => {
      window.removeEventListener("retentionedit:toast", handleToast);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-200 pointer-events-none">
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#1c1d22]/95 border border-white/15 text-white shadow-2xl backdrop-blur-xl pointer-events-auto">
        <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
        <span className="text-xs sm:text-sm font-medium tracking-wide text-zinc-100">
          {toast.message}
        </span>
      </div>
    </div>
  );
}
