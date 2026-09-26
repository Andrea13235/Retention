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
                const { loadProjectEntries } = await import("@/lib/projects-store");
                const existing = loadProjectEntries().find((p) => p.id === activeJobId);
                if (existing) {
                  const { upsertProject } = await import("@/lib/projects-store");
                  const { captureVideoCover } = await import("@/lib/video-cover");
                  const renderedUrl: string | undefined = fullJob.renderedVideoUrl;
                  // La copertina Higgsfield ad-hoc (se generata) ha precedenza;
                  // altrimenti frame reale del video; ultimo fallback: cover esistente.
                  const higgsCover: string | undefined = fullJob.thumbnailUrl;
                  const isHiggsCover =
                    typeof higgsCover === "string" &&
                    higgsCover.startsWith("/thumbnails/");
                  const freshCover = isHiggsCover
                    ? higgsCover
                    : renderedUrl
                      ? await captureVideoCover(renderedUrl).catch(() => null)
                      : null;
                  const realClips =
                    typeof fullJob?.stats?.cutsCount === "number" && fullJob.stats.cutsCount > 0
                      ? fullJob.stats.cutsCount
                      : existing.clipsCount;
                  await upsertProject(
                    {
                      ...existing,
                      title: fullJob.title || existing.title,
                      coverUrl: freshCover || existing.coverUrl,
                      videoUrl: renderedUrl && /^(https?:\/\/|\/)/.test(renderedUrl) && !renderedUrl.startsWith("blob:")
                        ? renderedUrl
                        : existing.videoUrl,
                      clipsCount: realClips,
                      status: "ready",
                    },
                    null
                  ).catch(() => {});
                }
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
      // always shows the cover already set.
      const sourceUrl = params.rawVideoUrl;
      const coverUrl = await captureVideoCover(sourceUrl).catch(() => null);

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
          ...(params.voiceoverText?.trim()
            ? { voiceoverText: params.voiceoverText.trim().slice(0, 900) }
            : {}),
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
          hasVoiceover: Boolean(params.voiceoverText?.trim()),
        },
        params.file && !isReplayable ? params.file : null
      ).catch(() => {});

      // Deduct credits on successful launch
      setCredits((prev) => Math.max(0, prev - requiredCredits));
      setActiveJobId(data.jobId);
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
          onTabChange={setActiveTab}
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
                try {
                  const r = await fetch(`/api/pipeline/result?jobId=${encodeURIComponent(jobId)}`);
                  if (!r.ok) return;
                  const j = (await r.json()) as PipelineJob;
                  setActiveJobId(jobId);
                  setJobData(j);
                  setActiveTab("home");
                } catch {}
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
    </>
  );
}
