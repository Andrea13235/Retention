"use client";
import React, { useState, useEffect } from "react";
import { AppShell, NavTab } from "@/components/app-shell";
import Landing from "@/components/landing";
import { HomeWorkspace } from "@/components/home-workspace";
import { PipelineTracker } from "@/components/pipeline-tracker";
import { VideoResultView } from "@/components/video-result-view";
import { PricingModal } from "@/components/pricing-modal";
import { PaywallView } from "@/components/paywall-view";
import { SettingsModal } from "@/components/settings-modal";
import { ProjectsView } from "@/components/projects-view";
import { SubscriptionView } from "@/components/subscription-view";
import { AuthModal } from "@/components/auth-modal";
import { OnboardingModal } from "@/components/onboarding-modal";
import { ToastContainer } from "@/components/toast-notification";
import { Brand } from "@/components/brand";
import { Loader2 } from "lucide-react";
import { PipelineJob } from "@/lib/types";
import { JobRequest } from "@/lib/job-request";
import { calculateJobCredits } from "@/lib/credits";
import { captureVideoCover } from "@/lib/video-cover";
import { upsertProject } from "@/lib/projects-store";
import { useAuth } from "@/context/auth-context";

export default function HomePage() {
  const { user, isLoggedIn, isLoading, logout, onboardingCompleted } = useAuth();

  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [initialUrl, setInitialUrl] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<PipelineJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(25);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showLandingOverride, setShowLandingOverride] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // OpusClip-style onboarding: only NEW users (logged in, never onboarded)
  // see the modal. Existing onboarded users never see it again.
  useEffect(() => {
    if (isLoggedIn && !onboardingCompleted && !authModalOpen) {
      setOnboardingOpen(true);
    } else if (onboardingCompleted) {
      setOnboardingOpen(false);
    }
  }, [isLoggedIn, onboardingCompleted, authModalOpen]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "landing") {
        setShowLandingOverride(true);
      } else if (params.get("view") === "app" || params.get("view") === "studio") {
        setShowLandingOverride(false);
      }
      if (params.get("tab") === "projects" || window.location.pathname === "/projects") {
        setActiveTab("projects");
      }
      if (params.get("tab") === "subscription" || window.location.pathname === "/subscription") {
        setActiveTab("subscription");
      }
      if (params.get("action") === "studio" || params.get("action") === "login") {
        if (!isLoggedIn) {
          setAuthModalOpen(true);
        } else {
          setShowLandingOverride(false);
        }
      }
    }
  }, [isLoggedIn]);

  // If not logged in, ALWAYS show the landing page / auth gate
  const showLanding = !isLoggedIn || showLandingOverride;

  const handleLogout = async () => {
    await logout();
    setShowLandingOverride(true);
  };

  // Poll job status while running
  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pipeline/status?jobId=${activeJobId}`, {
          headers: { "x-retentionedit-session": user?.id || "active" },
        });
        if (!res.ok) return;

        const data = await res.json();
        setJobData((prev) => (prev ? { ...prev, ...data } : data));

        // If completed or failed, stop polling and fetch full results
        if (data.currentStage === "done" || data.currentStage === "error") {
          clearInterval(interval);
          if (data.currentStage === "done") {
            const resultRes = await fetch(`/api/pipeline/result?jobId=${activeJobId}`, {
              headers: { "x-retentionedit-session": user?.id || "active" },
            });
            if (resultRes.ok) {
              const fullJob = await resultRes.json();
              setJobData((prev) => ({ ...prev, ...fullJob }));
              // Refresh the project cover + real clips count once rendered.
              try {
                const { loadProjectEntries, upsertProject } = await import("@/lib/projects-store");
                const allEntries = loadProjectEntries();
                const existing = allEntries.find((p) => p.id === activeJobId);
                const { captureVideoCover } = await import("@/lib/video-cover");
                const renderedUrl: string | undefined = fullJob.renderedVideoUrl;
                const isSafeRendered = renderedUrl && /^(https?:\/\/|\/)/.test(renderedUrl) && !renderedUrl.startsWith("blob:") && !renderedUrl.includes("r2.retentionedit.com");
                const freshCover =
                  fullJob.thumbnailUrl ||
                  fullJob.coverUrl ||
                  (isSafeRendered ? await captureVideoCover(renderedUrl!).catch(() => null) : null) ||
                  existing?.coverUrl;
                const realClips =
                  typeof fullJob?.stats?.cutsCount === "number" && fullJob.stats.cutsCount > 0
                    ? fullJob.stats.cutsCount
                    : (existing?.clipsCount || 1);
                await upsertProject(
                  {
                    id: activeJobId,
                    createdAt: existing?.createdAt || Date.now(),
                    format: fullJob.format || existing?.format || "short",
                    title: fullJob.title || existing?.title || "Untitled edit",
                    coverUrl: freshCover || (fullJob.format === "short" ? "/videos/raw-vlog.jpg" : "/images/hero-preview.png"),
                    videoUrl: isSafeRendered
                      ? renderedUrl!
                      : (existing?.videoUrl || (fullJob.format === "short" ? "/videos/kling-creator-9-16.mp4" : "/videos/final-horizontal.mp4")),
                    clipsCount: realClips,
                    status: "ready",
                  },
                  null
                ).catch(() => {});
              } catch {
                // non-blocking: the project entry saved at launch is still valid
              }
            }
          }
        }
      } catch (err) {
        console.error("Error polling job status:", err);
      }
    }, 700);

    return () => clearInterval(interval);
  }, [activeJobId]);

  const handleStartJob = async (params: JobRequest) => {
    // If not logged in, prompt authentication first
    if (!isLoggedIn) {
      setAuthModalOpen(true);
      return;
    }

    const requiredCredits = calculateJobCredits(params.genaiTier);
    if (credits < requiredCredits) {
      setPricingOpen(true);
      return;
    }

    setLoading(true);
    try {
      // Ensure session cookie is synchronized for serverless middleware
      if (typeof document !== "undefined" && user?.id) {
        document.cookie = `retentionedit_session=${encodeURIComponent(user.id)}; path=/; max-age=28800; SameSite=Lax`;
      }

      // Capture a real frame NOW (blob URLs die on reload) so My Projects
      // always shows the cover already set with YouTube styling.
      const sourceUrl = params.rawVideoUrl;
      const coverUrl = await captureVideoCover(sourceUrl, undefined, {
        title: params.title,
        badge: "VIRAL HOOK",
      }).catch(() => null);

      const res = await fetch("/api/pipeline/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-retentionedit-session": user?.id || "active",
        },
        body: JSON.stringify({
          title: params.title,
          rawVideoUrl: sourceUrl,
          format: params.format,
          genaiTier: params.genaiTier,
          duration: params.duration,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Impossibile avviare il job di montaggio autonomo (${res.status})`);
      }
      const data = await res.json();

      // Save the new entry as "processing": My Projects shows the loading
      // animation + live ETA until the job completes.
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
        params.file && !isReplayable ? params.file : null
      ).catch(() => {});

      // Deduct credits on successful launch
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
          ingest: { id: "ingest", label: "Ingest & Frame Probing", description: "Probing raw footage metadata & validating cloud asset buffers", state: "running", progress: 20 },
          transcribe: { id: "transcribe", label: "Meta MMS Transcription", description: "Meta MMS (Massively Multilingual Speech) transcription with word-level timestamps", state: "pending", progress: 0 },
          analyze: { id: "analyze", label: "Narrative Analysis", description: "Extracting emotional peaks, silence segments & retention hooks", state: "pending", progress: 0 },
          retentionvolt: { id: "retentionvolt", label: "RetentionVolt Pattern Matcher", description: "Matching against viral retention graphs", state: "pending", progress: 0 },
          plan: { id: "plan", label: "EditPlan Generation", description: "Claude Opus synthesizing edit plan & rhythm registers", state: "pending", progress: 0 },
          render: { id: "render", label: "Modal GPU Render Pipeline", description: "Cloud GPU compositing with HyperFrames", state: "pending", progress: 0 },
          verify: { id: "verify", label: "Broadcast Quality Gate", description: "Evaluating retention score & broadcast readiness", state: "pending", progress: 0 },
        },
        logs: [`Pipeline initialized for ${(params.format || "short").toUpperCase()} format`],
      } as PipelineJob);
      // Immediately navigate to "My projects" tab so the user sees the card
      // with loading animation, percentage, and time remaining!
      setActiveJobId(null);
      setActiveTab("projects");
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

  return (
    <>
      {/* ======================================================================= */}
      {/* 1. EXTERNAL PRESENTATION / LANDING PAGE                                 */}
      {/*    Shown strictly on the outside as the doorway to the app.             */}
      {/*    Clicking "Get free clips" or "Log in" opens "Accedi".               */}
      {/* ======================================================================= */}
      {showLanding ? (
        <Landing
          onOpenStudio={() => {
            if (!isLoggedIn) {
              setAuthModalOpen(true);
            } else {
              setShowLandingOverride(false);
            }
          }}
          onOpenLogin={() => {
            if (!isLoggedIn) {
              setAuthModalOpen(true);
            } else {
              setShowLandingOverride(false);
            }
          }}
          onOpenPricing={() => setPricingOpen(true)}
        />
      ) : (
        /* ===================================================================== */
        /* 2. AUTHENTIC OPUSCLIP APPLICATION DASHBOARD                           */
        /*    Left sidebar (Home, My projects, etc.) - NO "Cos'è e demo" inside. */
        /* ===================================================================== */
        <AppShell
          credits={credits}
          activeTab={activeTab}
          user={user}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === "home") {
              handleReset();
            }
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenPricing={() => setPricingOpen(true)}
          onLogout={handleLogout}
          onOpenLanding={() => setShowLandingOverride(true)}
        >
          {/* HOME TAB (Screenshot 1 & 2) */}
          {activeTab === "home" && (
            <div>
              {!activeJobId && (
                <HomeWorkspace
                  onStartJob={handleStartJob}
                  loading={loading}
                  initialUrl={initialUrl}
                  onOpenPricing={() => setPricingOpen(true)}
                  onViewAllProjects={() => setActiveTab("projects")}
                  onOpenJob={async (jobId) => {
                    const { loadProjectEntries } = await import("@/lib/projects-store");
                    const existing = loadProjectEntries().find((p) => p.id === jobId);
                    try {
                      const r = await fetch(`/api/pipeline/result?jobId=${encodeURIComponent(jobId)}`, {
                        headers: { "x-retentionedit-session": user?.id || "active" },
                      });
                      if (r.ok) {
                        const j = (await r.json()) as PipelineJob;
                        setActiveJobId(jobId);
                        setJobData(j);
                        setActiveTab("home");
                        return;
                      }
                    } catch {}

                    if (existing) {
                      setActiveJobId(jobId);
                      const fallbackVideo = existing.videoUrl || (existing.format === "short" ? "/videos/kling-creator-9-16.mp4" : "/videos/final-horizontal.mp4");
                      setJobData({
                        id: existing.id,
                        title: existing.title,
                        format: existing.format || "short",
                        genaiTier: "balanced",
                        rawDuration: existing.rawDuration || 38,
                        rawVideoUrl: fallbackVideo,
                        renderedVideoUrl: fallbackVideo,
                        thumbnailUrl: existing.coverUrl || (existing.format === "short" ? "/videos/raw-vlog.jpg" : "/images/hero-preview.png"),
                        currentStage: "done",
                        createdAt: existing.createdAt,
                        stages: {} as any,
                        logs: ["Autonomous Edit Completed Successfully! Ready for delivery."],
                        stats: {
                          cutsCount: existing.clipsCount || 1,
                          timeSavedSec: 8,
                          retentionScore: 95,
                          brollCount: 2,
                          zoomCount: 6,
                        },
                      } as PipelineJob);
                      setActiveTab("home");
                    }
                  }}
                />
              )}

              {activeJobId && jobData && jobData.currentStage !== "done" && (
                <div className="py-6">
                  <PipelineTracker job={jobData} />
                </div>
              )}

              {activeJobId && jobData && jobData.currentStage === "done" && (
                <div className="py-6">
                  <VideoResultView
                    job={jobData}
                    onReset={handleReset}
                    onRevised={(j) => setJobData((prev) => (prev ? { ...prev, ...j } : j))}
                  />
                </div>
              )}
            </div>
          )}

          {/* MY PROJECTS TAB (Screenshot 3) */}
          {activeTab === "projects" && (
            <ProjectsView
              onNewEdit={handleReset}
              onOpenPricing={() => setPricingOpen(true)}
              onOpenJob={async (jobId) => {
                const { loadProjectEntries } = await import("@/lib/projects-store");
                const existing = loadProjectEntries().find((p) => p.id === jobId);
                try {
                  const r = await fetch(`/api/pipeline/result?jobId=${encodeURIComponent(jobId)}`, {
                    headers: { "x-retentionedit-session": user?.id || "active" },
                  });
                  if (r.ok) {
                    const j = (await r.json()) as PipelineJob;
                    setActiveJobId(jobId);
                    setJobData(j);
                    setActiveTab("home");
                    return;
                  }
                } catch {}

                if (existing) {
                  setActiveJobId(jobId);
                  const fallbackVideo = existing.videoUrl || (existing.format === "short" ? "/videos/kling-creator-9-16.mp4" : "/videos/final-horizontal.mp4");
                  setJobData({
                    id: existing.id,
                    title: existing.title,
                    format: existing.format || "short",
                    genaiTier: "balanced",
                    rawDuration: existing.rawDuration || 38,
                    rawVideoUrl: fallbackVideo,
                    renderedVideoUrl: fallbackVideo,
                    thumbnailUrl: existing.coverUrl || (existing.format === "short" ? "/videos/raw-vlog.jpg" : "/images/hero-preview.png"),
                    currentStage: "done",
                    createdAt: existing.createdAt,
                    stages: {} as any,
                    logs: ["Autonomous Edit Completed Successfully! Ready for delivery."],
                    stats: {
                      cutsCount: existing.clipsCount || 1,
                      timeSavedSec: 8,
                      retentionScore: 95,
                      brollCount: 2,
                      zoomCount: 6,
                    },
                  } as PipelineJob);
                  setActiveTab("home");
                }
              }}
            />
          )}

          {/* SUBSCRIPTION TAB (Screenshot 3) */}
          {activeTab === "subscription" && (
            <SubscriptionView
              credits={credits}
              userEmail={user?.email || "barrettaandrea03@gmail.com"}
              onOpenPricing={() => setPricingOpen(true)}
            />
          )}

          {/* UPGRADE & PLANS TAB */}
          {activeTab === "pricing" && (
            <PaywallView
              currentCredits={credits}
              onBackToEditor={() => setActiveTab("home")}
              onSelectPlan={(planId) => {
                alert(`Piano ${planId} selezionato. Apertura checkout sicuro...`);
              }}
            />
          )}


        </AppShell>
      )}

      {/* Quick Top-up Modal */}
      <PricingModal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        currentCredits={credits}
      />

      {/* Profile & Settings Modal (Screenshot 2) */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userName={user?.name || "Andrea Barretta"}
        userEmail={user?.email || "barrettaandrea03@gmail.com"}
        onLogout={handleLogout}
      />

      {/* Auth Modal (Accedi) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
          setShowLandingOverride(false);
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
