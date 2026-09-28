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
                const allEntries = loadProjectEntries();
                const existing = allEntries.find((p) => p.id === activeJobId);
                const { captureVideoCover } = await import("@/lib/video-cover");
                const renderedUrl: string | undefined = fullJob.renderedVideoUrl;
                const isSafeRendered =
                  renderedUrl &&
                  /^(https?:\/\/|\/)/.test(renderedUrl) &&
                  !renderedUrl.startsWith("blob:") &&
                  !renderedUrl.includes("r2.retentionedit.com") &&
                  !renderedUrl.includes("cloudflarestorage.com") &&
                  !renderedUrl.includes("kling") &&
                  !renderedUrl.includes("raw-vlog") &&
                  !renderedUrl.includes("final-horizontal");
                const freshCover =
                  (existing?.coverUrl && !existing.coverUrl.includes("raw-vlog") ? existing.coverUrl : null) ||
                  (fullJob.thumbnailUrl && !fullJob.thumbnailUrl.includes("raw-vlog") ? fullJob.thumbnailUrl : null) ||
                  (fullJob.coverUrl && !fullJob.coverUrl.includes("raw-vlog") ? fullJob.coverUrl : null) ||
                  "";
                const realClips =
                  typeof fullJob?.stats?.cutsCount === "number" && fullJob.stats.cutsCount > 0
                    ? fullJob.stats.cutsCount
                    : existing?.clipsCount || 1;
                const safeExistingVideo =
                  existing?.videoUrl &&
                  !existing.videoUrl.includes("kling") &&
                  !existing.videoUrl.includes("r2.retentionedit.com") &&
                  !existing.videoUrl.includes("cloudflarestorage.com") &&
                  !existing.videoUrl.includes("raw-vlog") &&
                  !existing.videoUrl.includes("final-horizontal")
                    ? existing.videoUrl
                    : "";
                await upsertProject(
                  {
                    id: activeJobId,
                    createdAt: existing?.createdAt || Date.now(),
                    format: fullJob.format || existing?.format || "short",
                    title: fullJob.title || existing?.title || "Untitled edit",
                    coverUrl: freshCover || existing?.coverUrl || "/images/hero-preview.png",
                    videoUrl: isSafeRendered ? renderedUrl! : safeExistingVideo,
                    clipsCount: realClips,
                    status: "ready",
                    editPlan: fullJob.editPlan || existing?.editPlan,
                  },
                  null
                ).catch(() => {});
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

    // Feature gating per plan
    const { checkFeatureAccess } = await import("@/lib/stripe");
    if (params.genaiTier === "cinematic") {
      const gate = checkFeatureAccess(userPlan, "cinematic_tier");
      if (!gate.allowed) {
        showToast(
          gate.reason || "Il tier Cinematic Pro richiede un abbonamento Pro Studio o Agency.",
          5000
        );
        setPricingOpen(true);
        return;
      }
    } else if (params.genaiTier === "balanced") {
      const gate = checkFeatureAccess(userPlan, "balanced_tier");
      if (!gate.allowed && userPlan === "free") {
        showToast(gate.reason || "Il tier Balanced richiede almeno il piano Creator Starter.", 5000);
        setPricingOpen(true);
        return;
      }
    }

    const requiredCredits = calculateJobCredits(params.genaiTier);
    if (credits < requiredCredits) {
      showToast(`Crediti insufficienti (${credits}/${requiredCredits} pts). Effettua l'upgrade!`, 4000);
      setPricingOpen(true);
      return;
    }

    setLoading(true);
    try {
      if (typeof document !== "undefined" && user?.id) {
        document.cookie = `retentionedit_session=${encodeURIComponent(user.id)}; path=/; max-age=28800; SameSite=Lax`;
      }

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
          genaiTier: params.genaiTier,
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
      await upsertProject(
        {
          id: data.jobId as string,
          title: params.title || "Untitled edit",
          coverUrl: coverUrl ?? "",
          videoUrl: isReplayable ? sourceUrl : "",
          clipsCount: 1,
          createdAt: Date.now(),
          format: params.format,
          status: "processing",
          rawDuration: params.duration,
        },
        params.file ? params.file : null
      ).catch(() => {});

      const uploadFile = params.file;
      if (uploadFile) {
        // Kick off background render pipeline immediately so the video is 100% baked before loading finishes!
        (async () => {
          try {
            const { bakeEditedVideo } = await import("@/lib/video-baker");
            const dur = params.duration || 35;
            const initialPlan = {
              format: params.format || "short",
              source_duration: dur,
              target_duration: dur,
              cuts: [
                { start: 6.5, end: 7.1, keep: false },
                { start: 14.8, end: 15.5, keep: false },
              ],
              zooms: [
                { time: 1.0, type: "zoom_punch", scale: 1.18, duration: 0.8 },
                { time: 4.2, type: "slow_zoom", scale: 1.14, duration: 1.5 },
                { time: 7.4, type: "zoom_punch", scale: 1.18, duration: 0.8 },
                { time: 10.6, type: "slow_zoom", scale: 1.14, duration: 1.5 },
                { time: 13.8, type: "zoom_punch", scale: 1.18, duration: 0.8 },
              ],
            };
            await bakeEditedVideo(data.jobId, uploadFile, initialPlan, {
              format: params.format,
            });
          } catch (e) {
            console.warn("[startJob] Background pre-baking error:", e);
          }
        })();
      }

      setCredits((prev) => Math.max(0, prev - requiredCredits));
      setJobData({
        id: data.jobId,
        title: params.title || "Untitled edit",
        format: params.format || "short",
        genaiTier: params.genaiTier || "balanced",
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
                  await realEdit.startEdit(file, title);
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
                        const isDead =
                          !j.renderedVideoUrl ||
                          j.renderedVideoUrl.includes("cloudflarestorage.com") ||
                          j.renderedVideoUrl.includes("r2.retentionedit.com") ||
                          j.renderedVideoUrl.includes("kling") ||
                          j.renderedVideoUrl.includes("raw-vlog") ||
                          j.renderedVideoUrl.includes("final-horizontal");
                        if (isDead) {
                          j.renderedVideoUrl =
                            j.rawVideoUrl &&
                            !j.rawVideoUrl.includes("cloudflarestorage.com") &&
                            !j.rawVideoUrl.includes("raw-vlog")
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
                    const safeVid =
                      existing.videoUrl &&
                      !existing.videoUrl.includes("kling") &&
                      !existing.videoUrl.includes("r2.retentionedit.com") &&
                      !existing.videoUrl.includes("cloudflarestorage.com") &&
                      !existing.videoUrl.includes("raw-vlog") &&
                      !existing.videoUrl.includes("final-horizontal")
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

            {/* Risultato motore reale: player + DOWNLOAD MP4 */}
            {!activeJobId && realEdit.stage === "done" && realEdit.status?.downloadUrl && (
              <div className="w-full max-w-[720px] mx-auto mt-4 rounded-2xl overflow-hidden border border-white/10 bg-black">
                <div className="p-4 flex items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{realEdit.status.title}</p>
                    <p className="text-[11px] text-[#8c8c90] mt-0.5">
                      {realEdit.status.sourceDuration?.toFixed(1)}s → {realEdit.status.finalDuration?.toFixed(1)}s
                      {typeof realEdit.status.timeSavedSec === "number" && realEdit.status.timeSavedSec > 0 && (
                        <span> · −{realEdit.status.timeSavedSec.toFixed(1)}s di silenzi</span>
                      )}
                      {typeof realEdit.status.captionsBurned === "number" && realEdit.status.captionsBurned > 0 && (
                        <span> · {realEdit.status.captionsBurned} caption</span>
                      )}
                      {typeof realEdit.status.zoomsApplied === "number" && realEdit.status.zoomsApplied > 0 && (
                        <span> · {realEdit.status.zoomsApplied} zoom</span>
                      )}
                      {typeof realEdit.status.brollsApplied === "number" && realEdit.status.brollsApplied > 0 && (
                        <span> · {realEdit.status.brollsApplied} B-roll</span>
                      )}
                      {typeof realEdit.status.bytes === "number" && (
                        <span> · {(realEdit.status.bytes / 1048576).toFixed(1)} MB</span>
                      )}
                    </p>
                  </div>
                  <a
                    href={realEdit.status.downloadUrl}
                    download
                    className="shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition"
                  >
                    DOWNLOAD MP4
                  </a>
                </div>
                <video src={realEdit.status.downloadUrl} controls playsInline preload="metadata" className="w-full aspect-video bg-black" />
              </div>
            )}

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
                    const isDead =
                      !j.renderedVideoUrl ||
                      j.renderedVideoUrl.includes("cloudflarestorage.com") ||
                      j.renderedVideoUrl.includes("r2.retentionedit.com") ||
                      j.renderedVideoUrl.includes("kling") ||
                      j.renderedVideoUrl.includes("raw-vlog") ||
                      j.renderedVideoUrl.includes("final-horizontal");
                    if (isDead) {
                      j.renderedVideoUrl =
                        j.rawVideoUrl &&
                        !j.rawVideoUrl.includes("cloudflarestorage.com") &&
                        !j.rawVideoUrl.includes("raw-vlog")
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
                const safeVid =
                  existing.videoUrl &&
                  !existing.videoUrl.includes("kling") &&
                  !existing.videoUrl.includes("r2.retentionedit.com") &&
                  !existing.videoUrl.includes("cloudflarestorage.com") &&
                  !existing.videoUrl.includes("raw-vlog") &&
                  !existing.videoUrl.includes("final-horizontal")
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
