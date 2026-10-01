"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell, NavTab } from "@/components/app-shell";
import { HomeWorkspace } from "@/components/home-workspace";
import { PipelineTracker } from "@/components/pipeline-tracker";
import { VideoResultView } from "@/components/video-result-view";
import { PricingModal } from "@/components/pricing-modal";
import { PaywallView } from "@/components/paywall-view";
import { SettingsModal } from "@/components/settings-modal";
import { ProjectsView } from "@/components/projects-view";
import { SubscriptionView } from "@/components/subscription-view";
import { AuthModal } from "@/components/auth-modal";
import { useRealEdit } from "@/hooks/use-real-edit";
import { OnboardingModal } from "@/components/onboarding-modal";
import { ToastContainer, showToast } from "@/components/toast-notification";
import { Loader2 } from "lucide-react";
import { PipelineJob } from "@/lib/types";
import type { GenAITier } from "@/lib/types";
import { JobRequest } from "@/lib/job-request";
import { calculateJobCredits } from "@/lib/credits";
import { captureVideoCover } from "@/lib/video-cover";
import { upsertProject } from "@/lib/projects-store";
import { useAuth } from "@/context/auth-context";
import { PlanId } from "@/lib/stripe";

function AppWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn, isLoading, logout, onboardingCompleted } = useAuth();

  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [initialUrl, setInitialUrl] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<PipelineJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(25);
  const [userPlan, setUserPlan] = useState<PlanId>("free");
  const [pricingOpen, setPricingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const realEdit = useRealEdit();

  // If not logged in and not loading, prompt login
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      setAuthModalOpen(true);
    } else if (isLoggedIn) {
      setAuthModalOpen(false);
    }
  }, [isLoggedIn, isLoading]);

  // OpusClip-style onboarding: only NEW users (logged in, never onboarded)
  useEffect(() => {
    if (isLoggedIn && !onboardingCompleted && !authModalOpen) {
      setOnboardingOpen(true);
    } else if (onboardingCompleted) {
      setOnboardingOpen(false);
    }
  }, [isLoggedIn, onboardingCompleted, authModalOpen]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tabParam = searchParams.get("tab");
      if (tabParam === "projects" || window.location.pathname.includes("/projects")) {
        setActiveTab("projects");
      }
      if (tabParam === "subscription" || window.location.pathname.includes("/subscription")) {
        setActiveTab("subscription");
      }
      if (tabParam === "pricing") {
        setActiveTab("pricing");
      }

      // Stripe Checkout return processing
      const stripeStatus = searchParams.get("stripe");
      if (stripeStatus === "success") {
        const plan = (searchParams.get("plan") || "pro") as PlanId;
        const grantedCredits = Number(searchParams.get("credits")) || 750;
        setUserPlan(plan);
        setCredits((prev) => Math.max(prev, grantedCredits));
        showToast(
          `🎉 Abbonamento ${plan.toUpperCase()} attivato con successo! ${grantedCredits} crediti disponibili.`,
          5000
        );
        setActiveTab("subscription");
        window.history.replaceState({}, "", "/app?tab=subscription");
      } else if (stripeStatus === "canceled") {
        showToast("Checkout Stripe annullato. Nessun addebito effettuato.", 3500);
        window.history.replaceState({}, "", "/app");
      }
    }
  }, [searchParams]);

  // Synchronize live Stripe subscription status
  useEffect(() => {
    if (!user?.email) return;
    fetch(`/api/stripe/status?email=${encodeURIComponent(user.email)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.plan) {
          setUserPlan(data.plan);
          if (data.isSubscribed && data.credits) {
            setCredits((prev) => Math.max(prev, data.credits));
          }
        }
      })
      .catch(() => {});
  }, [user?.email]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  // Poll job status while running
  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pipeline/status?jobId=${activeJobId}`, {
          headers: {
            ...(user?.id ? { "x-retentionedit-session": user.id } : {}),
          },
        });
        if (!res.ok) return;

        const data = await res.json();
        setJobData((prev) => (prev ? { ...prev, ...data } : data));

        // If completed or failed, stop polling and fetch full results
        if (data.currentStage === "done" || data.currentStage === "error") {
          clearInterval(interval);
          if (data.currentStage === "done") {
            const resultRes = await fetch(`/api/pipeline/result?jobId=${activeJobId}`, {
              headers: {
                ...(user?.id ? { "x-retentionedit-session": user.id } : {}),
              },
            });
            if (resultRes.ok) {
              const fullJob = await resultRes.json();
              setJobData((prev) => ({ ...prev, ...fullJob }));
              try {
                const { loadProjectEntries, upsertProject } = await import("@/lib/projects-store");
                const allEntries = loadProjectEntries(user?.id);
                const existing = allEntries.find((p) => p.id === activeJobId);
                const renderedUrl: string | undefined = fullJob.renderedVideoUrl;
                // SOLO video reale: MP4 montato dal server (Modal GPU) oppure presigned/relay.
                // Niente più blacklist kling/raw-vlog/final-horizontal (demo rimossi).
                const isSafeRendered =
                  renderedUrl &&
                  /^(https?:\/\/|\/|r2:\/\/)/.test(renderedUrl) &&
                  !renderedUrl.startsWith("blob:") &&
                  !renderedUrl.includes("cloudflarestorage.com");
                // A fine lavoro: copertina ad-hoc + titolo YouTube dal server.
                // Il server li ha già composti (frame reale + headline); qui
                // prendiamo SOLO quelli finali — niente cover provvisorie.
                const freshCover =
                  (fullJob.thumbnailUrl ? fullJob.thumbnailUrl : null) ||
                  (fullJob.coverUrl ? fullJob.coverUrl : null) ||
                  (existing?.coverUrl ? existing.coverUrl : null) ||
                  "";
                const finalTitle = fullJob.title || existing?.title || "Untitled edit";
                const realClips =
                  typeof fullJob?.stats?.cutsCount === "number" && fullJob.stats.cutsCount > 0
                    ? fullJob.stats.cutsCount
                    : existing?.clipsCount || 1;
                const safeExistingVideo =
                  existing?.videoUrl &&
                  !existing.videoUrl.includes("cloudflarestorage.com")
                    ? existing.videoUrl
                    : "";
                await upsertProject(
                  {
                    id: activeJobId,
                    createdAt: existing?.createdAt || Date.now(),
                    format: fullJob.format || existing?.format || "short",
                    title: finalTitle,
                    coverUrl: freshCover || existing?.coverUrl || "/images/hero-preview.png",
                    videoUrl: isSafeRendered ? renderedUrl! : safeExistingVideo,
                    clipsCount: realClips,
                    status: "ready",
                    editPlan: fullJob.editPlan || existing?.editPlan,
                  },
                  null,
                  user?.id
                ).catch(() => {});
                // La card "Recent projects" ora è pronta con cover ad-hoc +
                // titolo YouTube: apri subito la schematica video (deciso).
                setActiveTab("home");
              } catch {
                // non-blocking
              }
            }
          }
        }
      } catch (err) {
        console.error("Error polling job status:", err);
      }
    }, 700);

    return () => clearInterval(interval);
  }, [activeJobId, user?.id]);

  const handleStartJob = async (params: JobRequest) => {
    if (!isLoggedIn) {
      setAuthModalOpen(true);
      return;
    }

    // Edit in one click è SEMPRE balanced Opus high a 5.5 — forza qui a prescindere da cosa passa la UI.
    const effectiveTier: GenAITier = "balanced";
    // Feature gating per plan — sempre su balanced (unico tier attivo)
    {
      const gate = await import("@/lib/stripe").then((m) => m.checkFeatureAccess(userPlan, "balanced_tier" as any));
      if (!gate.allowed && userPlan === "free") {
        showToast(gate.reason || "Il tier Balanced richiede almeno il piano Creator Starter.", 5000);
        setPricingOpen(true);
        return;
      }
    }

    const requiredCredits = calculateJobCredits(effectiveTier);
    if (credits < requiredCredits) {
      showToast(`Crediti insufficienti (${credits}/${requiredCredits} pts). Effettua l'upgrade!`, 4000);
      setPricingOpen(true);
      return;
    }

    setLoading(true);
    // Card istantanea: se il chiamante (home-workspace) l'ha già creata al click
    // (status "uploading"), riusa il suo pendingId — altrimenti creane una qui.
    // In OGNI caso l'utente vede il progetto in My Projects SUBITO.
    const pendingId =
      params.pendingId ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `pending_${crypto.randomUUID()}`
        : `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    if (!params.pendingId) {
    try {
      const { upsertProject } = await import("@/lib/projects-store");
      await upsertProject(
        {
          id: pendingId,
          title: params.title || "Untitled edit",
          coverUrl: "",
          videoUrl: "",
          clipsCount: 1,
          createdAt: Date.now(),
          format: params.format || "short",
          status: "processing",
          rawDuration: params.duration,
        },
        params.file ? params.file : null,
        user?.id
      ).catch(() => {});
    } catch {}
    }
    try {
      // Session: the server minted a signed HttpOnly cookie at login — the
      // browser sends it automatically. Never overwrite it with the raw id.

      const sourceUrl = params.rawVideoUrl;
      let coverUrl = params.coverUrl || null;
      if (!coverUrl) {
        const frameBlob = params.file ? URL.createObjectURL(params.file) : null;
        const frameSource =
          frameBlob ||
          (sourceUrl.startsWith("http") || sourceUrl.startsWith("/") || sourceUrl.startsWith("blob:")
            ? sourceUrl
            : "");
        if (frameSource) {
          coverUrl = await captureVideoCover(frameSource, 1.2, {
            title: params.title,
            badge: "VIRAL HOOK",
          }).catch(() => null);
        }
      }

      const res = await fetch("/api/pipeline/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.id ? { "x-retentionedit-session": user.id } : {}),
          "x-user-plan": userPlan,
        },
        body: JSON.stringify({
          title: params.title,
          rawVideoUrl: sourceUrl,
          format: params.format,
          genaiTier: effectiveTier,
          duration: params.duration,
          userPlan,
          ...(params.r2Key ? { r2Key: params.r2Key } : {}),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(
          errJson?.error || `Impossibile avviare il job di montaggio autonomo (${res.status})`
        );
      }
      const data = await res.json();

      const isReplayable = /^(https?:\/\/|\/)/.test(sourceUrl) && !sourceUrl.startsWith("blob:");
      // Riconcilia la card istantanea (pendingId) col jobId reale: sposta cover/blob,
      // aggiorna la card e cancella il pending — MAI duplicare.
      try {
        const store = await import("@/lib/projects-store");
        const pending = store.loadProjectEntries(user?.id).find((p) => p.id === pendingId);
        const pendingBlob = await store.getProjectBlob(pendingId).catch(() => null);
        await upsertProject(
          {
            id: data.jobId as string,
            title: params.title || pending?.title || "Untitled edit",
            coverUrl: coverUrl ?? pending?.coverUrl ?? "",
            videoUrl: isReplayable ? sourceUrl : (pending?.videoUrl ?? ""),
            clipsCount: 1,
            createdAt: pending?.createdAt || Date.now(),
            format: params.format,
            status: "processing",
            rawDuration: params.duration,
          },
          params.file ? params.file : pendingBlob,
          user?.id
        ).catch(() => {});
        if (pending) {
          try { await store.deleteProject(pendingId, user?.id); } catch {}
          // deleteProject notifica; re-inserisci il job reale se la delete lo avesse toccato
          // (delete filtra per id, quindi il job reale resta — nessuna azione extra).
        }
      } catch {}

      const uploadFile = params.file;
      // NIENTE pre-bake con piano finto: il montaggio parte solo col piano
      // REALE del server (il pre-bake inventava tagli 6.5s prima del vero edit).

      setCredits((prev) => Math.max(0, prev - requiredCredits));
      setJobData({
        id: data.jobId,
        title: params.title || "Untitled edit",
        format: params.format || "short",
        genaiTier: effectiveTier,
        rawDuration: params.duration || 30,
        rawVideoUrl: sourceUrl,
        currentStage: "ingest",
        createdAt: Date.now(),
        stages: {
          ingest: {
            id: "ingest",
            label: "Ingest & Frame Probing",
            description: "Probing raw footage metadata & validating cloud asset buffers",
            state: "running",
            progress: 20,
          },
          transcribe: {
            id: "transcribe",
            label: "Meta MMS Transcription",
            description: "Meta MMS (Massively Multilingual Speech) transcription with word-level timestamps",
            state: "pending",
            progress: 0,
          },
          analyze: {
            id: "analyze",
            label: "Narrative Analysis",
            description: "Extracting emotional peaks, silence segments & retention hooks",
            state: "pending",
            progress: 0,
          },
          retentionvolt: {
            id: "retentionvolt",
            label: "RetentionVolt Pattern Matcher",
            description: "Matching against viral retention graphs",
            state: "pending",
            progress: 0,
          },
          plan: {
            id: "plan",
            label: "EditPlan Generation",
            description: "Claude Opus synthesizing edit plan & rhythm registers",
            state: "pending",
            progress: 0,
          },
          render: {
            id: "render",
            label: "Modal GPU Render Pipeline",
            description: "Cloud GPU compositing with HyperFrames",
            state: "pending",
            progress: 0,
          },
          verify: {
            id: "verify",
            label: "Broadcast Quality Gate",
            description: "Evaluating retention score & broadcast readiness",
            state: "pending",
            progress: 0,
          },
        },
        logs: [`Pipeline initialized for ${(params.format || "short").toUpperCase()} format`],
      } as PipelineJob);

      setActiveJobId(null);
      setActiveTab("home");
    } catch (err: any) {
      // Il backend ha fallito: la card istantanea resta visibile ma marcata come fallita
      // (titolo con ⚠) invece di sparire in silenzio — l'utente sa sempre che è successo.
      try {
        const store = await import("@/lib/projects-store");
        const pending = store.loadProjectEntries(user?.id).find((p) => p.id === pendingId);
        if (pending) {
          store.updateProject(pendingId, {
            title: `${pending.title} — ⚠ avvio fallito, riprova`,
          }, user?.id);
        }
      } catch {}
      alert(`Errore avvio job: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveJobId(null);
    setJobData(null);
    setActiveTab("home");
  };

  const isEditorView = !!(
    activeJobId &&
    jobData &&
    jobData.currentStage === "done" &&
    activeTab === "home"
  );

  return (
    <>
      <AppShell
        credits={credits}
        activeTab={activeTab}
        user={user}
        noScroll={isEditorView}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === "home") {
            handleReset();
          }
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenPricing={() => setPricingOpen(true)}
        onLogout={handleLogout}
        onOpenLanding={() => router.push("/")}
      >
        {/* HOME TAB */}
        {activeTab === "home" && (
          <div>
            {!activeJobId && (
              <HomeWorkspace
                onStartJob={handleStartJob}
                loading={loading}
                onOpenPricing={() => setPricingOpen(true)}
                onViewAllProjects={() => setActiveTab("projects")}
                realEdit={async (file, title) => {
                  if (!isLoggedIn) {
                    setAuthModalOpen(true);
                    return;
                  }
                  // Motore REALE: upload → ElevenLabs STT → silenzi → ffmpeg MP4.
                  // startEdit risolve con lo status terminale (done/error).
                  // A fine edit: card "ready" col MP4 reale scaricabile.
                  const cleanTitle = title || file.name.replace(/\.[^/.]+$/, "");
                  const { upsertProject, putProjectBlob } = await import("@/lib/projects-store");
                  const cardId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                  try {
                    await upsertProject(
                      {
                        id: cardId,
                        title: cleanTitle,
                        coverUrl: "",
                        videoUrl: "",
                        clipsCount: 1,
                        createdAt: Date.now(),
                        format: "short",
                        status: "uploading",
                        uploadPct: 0,
                        rawDuration: 38,
                      },
                      file,
                      user?.id
                    ).catch(() => {});
                  } catch {}
                  try {
                    try {
                      const { updateProject } = await import("@/lib/projects-store");
                      updateProject(cardId, { status: "processing", uploadPct: undefined }, user?.id);
                    } catch {}
                    const final = await realEdit.startEdit(file, cleanTitle);
                    // Titolo YouTube dal server (Claude + Vault, transcript reale).
                    // Prima di questo fix la card mostrava il nome file RAW.
                    const ytTitle = (final.title || cleanTitle).trim().slice(0, 100);
                    // Cover: preferisci la cover YouTube Higgsfield ad-hoc;
                    // fallback sul frame ffmpeg. Scarica ENTRAMBE in IDB così
                    // la card resta visibile anche dopo il reload.
                    const ytCoverUrl = final.youtubeCoverUrl || null;
                    const frameCoverUrl = final.coverUrl || null;
                    const bestCoverUrl = ytCoverUrl || frameCoverUrl || "";
                    // Scarica l'MP4 REALE montato dal server e salvalo in IDB
                    // così la card resta riproducibile anche dopo il reload.
                    let mp4Blob: Blob | null = null;
                    try {
                      if (final.downloadUrl) {
                        const r = await fetch(final.downloadUrl, {
                          headers: { ...(user?.id ? { "x-retentionedit-session": user.id } : {}) },
                        });
                        if (r.ok) {
                          const buf = await r.blob();
                          if (buf && buf.size > 0) mp4Blob = buf;
                        }
                      }
                    } catch {}
                    if (mp4Blob) {
                      try { await putProjectBlob(`${cardId}_rendered`, mp4Blob); } catch {}
                    }
                    // Cover Higgsfield in IDB (stessa chiave della card).
                    try {
                      if (ytCoverUrl) {
                        const rc = await fetch(ytCoverUrl, {
                          headers: { ...(user?.id ? { "x-retentionedit-session": user.id } : {}) },
                        });
                        if (rc.ok) {
                          const cb = await rc.blob();
                          if (cb && cb.size > 2048) {
                            try { await putProjectBlob(`${cardId}_cover`, cb); } catch {}
                          }
                        }
                      }
                    } catch {}
                    try {
                      const { updateProject } = await import("@/lib/projects-store");
                      updateProject(cardId, {
                        title: ytTitle,
                        coverUrl: bestCoverUrl,
                        videoUrl: final.downloadUrl || "",
                        clipsCount: (final.cutsCount ?? 0) + 1,
                        status: "ready",
                        rawDuration: final.sourceDuration,
                      }, user?.id);
                    } catch {}
                    showToast("Video editato — MP4 pronto da scaricare", 4000);
                  } catch (e) {
                    try {
                      const { updateProject } = await import("@/lib/projects-store");
                      updateProject(cardId, {
                        title: `${cleanTitle} — ⚠ edit fallito, riprova`,
                      }, user?.id);
                    } catch {}
                    showToast(e instanceof Error ? e.message : "Edit fallito", 5000);
                  }
                }}
                realEditBusy={realEdit.stage !== "idle" && realEdit.stage !== "done" && realEdit.stage !== "error"}
                realEditStatus={
                  realEdit.stage === "done"
                    ? "Pronto — MP4 scaricabile"
                    : realEdit.stage === "error" || realEdit.stage === "idle"
                      ? null
                      : realEdit.stage === "uploading"
                        ? `Caricamento ${realEdit.progress}%…`
                        : realEdit.stage === "transcribe"
                          ? "Trascrizione reale (Muse Voice)…"
                          : realEdit.stage === "cuts"
                            ? "Taglio silenzi reali…"
                            : `Render MP4 ${realEdit.progress}%…`
                }
                realEditError={realEdit.error}
                onOpenJob={async (jobId) => {
                  const { loadProjectEntries, getProjectBlob } = await import(
                    "@/lib/projects-store"
                  );
                  const existing = loadProjectEntries().find((p) => p.id === jobId);
                  let userBlobUrl: string | null = null;
                  try {
                    const rendered = await getProjectBlob(`${jobId}_rendered`);
                    if (rendered && rendered.size > 0) {
                      userBlobUrl = URL.createObjectURL(rendered);
                    } else {
                      const b = await getProjectBlob(jobId);
                      if (b) userBlobUrl = URL.createObjectURL(b);
                    }
                  } catch {}

                  try {
                    const r = await fetch(
                      `/api/pipeline/result?jobId=${encodeURIComponent(jobId)}`,
                      {
                        headers: { "x-retentionedit-session": user?.id || "active" },
                      }
                    );
                    if (r.ok) {
                      const j = (await r.json()) as PipelineJob;
                      if (!j.editPlan && existing?.editPlan) {
                        j.editPlan = existing.editPlan;
                      }
                      if (userBlobUrl) {
                        j.rawVideoUrl = userBlobUrl;
                        j.renderedVideoUrl = userBlobUrl;
                      } else {
                        // SOLO video reale — niente blacklist demo (rimossi).
                        const isDead =
                          !j.renderedVideoUrl ||
                          j.renderedVideoUrl.includes("cloudflarestorage.com");
                        if (isDead) {
                          j.renderedVideoUrl =
                            j.rawVideoUrl &&
                            !j.rawVideoUrl.includes("cloudflarestorage.com")
                              ? j.rawVideoUrl
                              : "";
                        }
                      }
                      setActiveJobId(jobId);
                      setJobData(j);
                      setActiveTab("home");
                      return;
                    }
                  } catch {}

                  if (existing) {
                    setActiveJobId(jobId);
                    // SOLO video reale — niente blacklist demo (rimossi).
                    const safeVid =
                      existing.videoUrl &&
                      !existing.videoUrl.includes("cloudflarestorage.com")
                        ? existing.videoUrl
                        : null;
                    const fallbackVideo = userBlobUrl || safeVid || "";
                    setJobData({
                      id: existing.id,
                      title: existing.title,
                      format: existing.format || "short",
                      genaiTier: "balanced",
                      rawDuration: existing.rawDuration || 38,
                      rawVideoUrl: fallbackVideo,
                      renderedVideoUrl: fallbackVideo,
                      thumbnailUrl: existing.coverUrl || "/images/hero-preview.png",
                      currentStage: "done",
                      createdAt: existing.createdAt,
                      stages: {} as any,
                      logs: ["Autonomous Edit Completed Successfully! Ready for delivery."],
                      editPlan: existing.editPlan,
                      stats: {
                        cutsCount: existing.clipsCount || 0,
                        timeSavedSec: 0, // M5: non misurato nel flusso legacy
                        retentionScore: 0, // M5: 0 = non misurato, mai inventato
                        brollCount: 0,
                        zoomCount: 0,
                      },
                    } as PipelineJob);
                    setActiveTab("home");
                  }
                }}
              />
            )}

            {/* A fine lavoro la card "Recent projects" è già pronta con
                copertina ad-hoc + titolo YouTube: il click sulla card
                (onOpenJob) apre la schematica video. Niente box separato. */}

            {activeJobId && jobData && jobData.currentStage !== "done" && (
              <div className="py-6">
                <PipelineTracker job={jobData} />
              </div>
            )}

            {activeJobId && jobData && jobData.currentStage === "done" && (
              <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
                <VideoResultView
                  job={jobData}
                  onReset={handleReset}
                  onRevised={(j) => setJobData((prev) => (prev ? { ...prev, ...j } : j))}
                />
              </div>
            )}
          </div>
        )}

        {/* MY PROJECTS TAB */}
        {activeTab === "projects" && (
          <ProjectsView
            onNewEdit={handleReset}
            onOpenPricing={() => setPricingOpen(true)}
            onOpenJob={async (jobId) => {
              const { loadProjectEntries, getProjectBlob } = await import("@/lib/projects-store");
              const existing = loadProjectEntries().find((p) => p.id === jobId);
              let userBlobUrl: string | null = null;
              try {
                const rendered = await getProjectBlob(`${jobId}_rendered`);
                if (rendered && rendered.size > 0) {
                  userBlobUrl = URL.createObjectURL(rendered);
                } else {
                  const b = await getProjectBlob(jobId);
                  if (b) userBlobUrl = URL.createObjectURL(b);
                }
              } catch {}

              try {
                const r = await fetch(
                  `/api/pipeline/result?jobId=${encodeURIComponent(jobId)}`,
                  {
                    headers: { "x-retentionedit-session": user?.id || "active" },
                  }
                );
                if (r.ok) {
                  const j = (await r.json()) as PipelineJob;
                  if (!j.editPlan && existing?.editPlan) {
                    j.editPlan = existing.editPlan;
                  }
                  if (userBlobUrl) {
                    j.rawVideoUrl = userBlobUrl;
                    j.renderedVideoUrl = userBlobUrl;
                  } else {
                    // SOLO video reale — niente blacklist demo (rimossi).
                    const isDead =
                      !j.renderedVideoUrl ||
                      j.renderedVideoUrl.includes("cloudflarestorage.com");
                    if (isDead) {
                      j.renderedVideoUrl =
                        j.rawVideoUrl &&
                        !j.rawVideoUrl.includes("cloudflarestorage.com")
                          ? j.rawVideoUrl
                          : "";
                    }
                  }
                  setActiveJobId(jobId);
                  setJobData(j);
                  setActiveTab("home");
                  return;
                }
              } catch {}

              if (existing) {
                setActiveJobId(jobId);
                // SOLO video reale — niente blacklist demo (rimossi).
                const safeVid =
                  existing.videoUrl &&
                  !existing.videoUrl.includes("cloudflarestorage.com")
                    ? existing.videoUrl
                    : null;
                const fallbackVideo = userBlobUrl || safeVid || "";
                setJobData({
                  id: existing.id,
                  title: existing.title,
                  format: existing.format || "short",
                  genaiTier: "balanced",
                  rawDuration: existing.rawDuration || 38,
                  rawVideoUrl: fallbackVideo,
                  renderedVideoUrl: fallbackVideo,
                  thumbnailUrl: existing.coverUrl || "/images/hero-preview.png",
                  currentStage: "done",
                  createdAt: existing.createdAt,
                  stages: {} as any,
                  logs: ["Autonomous Edit Completed Successfully! Ready for delivery."],
                  editPlan: existing.editPlan,
                  stats: {
                    cutsCount: existing.clipsCount || 0,
                    timeSavedSec: 0, // M5: non misurato nel flusso legacy
                    retentionScore: 0, // M5: 0 = non misurato, mai inventato
                    brollCount: 0,
                    zoomCount: 0,
                  },
                } as PipelineJob);
                setActiveTab("home");
              }
            }}
          />
        )}

        {/* SUBSCRIPTION TAB */}
        {activeTab === "subscription" && (
          <SubscriptionView
            credits={credits}
            userEmail={user?.email || "creator@retentionedit.com"}
            planId={userPlan}
            onOpenPricing={() => setPricingOpen(true)}
          />
        )}

        {/* UPGRADE & PLANS TAB */}
        {activeTab === "pricing" && (
          <PaywallView
            currentCredits={credits}
            onBackToEditor={() => setActiveTab("home")}
            onSelectPlan={async (planId) => {
              try {
                const res = await fetch("/api/stripe/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    planId,
                    interval: "month",
                    userEmail: user?.email,
                  }),
                });
                const data = await res.json();
                if (data.url) {
                  window.location.href = data.url;
                } else {
                  throw new Error(data.error || "Impossibile aprire il checkout");
                }
              } catch (e: any) {
                alert(`Errore checkout: ${e.message}`);
              }
            }}
          />
        )}
      </AppShell>

      {/* Quick Top-up Modal */}
      <PricingModal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        currentCredits={credits}
      />

      {/* Profile & Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userName={user?.name || "Creator"}
        userEmail={user?.email || "creator@retentionedit.com"}
        onLogout={handleLogout}
      />

      {/* Auth Modal (when unauthenticated) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          if (!isLoggedIn) {
            router.push("/");
          } else {
            setAuthModalOpen(false);
          }
        }}
        onSuccess={() => {
          setAuthModalOpen(false);
        }}
      />

      {/* Onboarding (OpusClip-style) — new users only */}
      <OnboardingModal
        isOpen={onboardingOpen}
        onFinished={() => setOnboardingOpen(false)}
        onOpenPaywall={() => setPricingOpen(true)}
      />

      {/* Global floating toast notification */}
      <ToastContainer />
    </>
  );
}

export default function AppWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-white">
          <div className="flex items-center gap-3 text-sm text-[#8c8c90]">
            <Loader2 className="w-5 h-5 animate-spin text-[#d1fe17]" />
            <span>Caricamento RetentionEdit Studio...</span>
          </div>
        </div>
      }
    >
      <AppWorkspaceContent />
    </Suspense>
  );
}
