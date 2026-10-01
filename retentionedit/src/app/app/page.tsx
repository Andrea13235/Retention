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

  // Vecchio poll pipeline demo disattivato: il montaggio reale vive in
  // HomeWorkspace → ProcessingProjectCard → /api/local-render/status.
  // Questo effect resta solo per tenere aperto un player quando l'utente
  // clicca su una card già pronta (viewer sotto).
  useEffect(() => {
    void activeJobId;
  }, [activeJobId]);

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
                loading={loading}
                onOpenPricing={() => setPricingOpen(true)}
                onViewAllProjects={() => setActiveTab("projects")}
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
