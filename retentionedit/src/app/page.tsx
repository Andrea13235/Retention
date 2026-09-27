"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Landing from "@/components/landing";
import { PricingModal } from "@/components/pricing-modal";
import { AuthModal } from "@/components/auth-modal";
import { ToastContainer } from "@/components/toast-notification";
import { useAuth } from "@/context/auth-context";

/**
 * Public Presentation / Landing Screen (Root Domain)
 *
 * Dedicated strictly to marketing, product presentation, features, ROI demo,
 * testimonials, and conversion.
 *
 * When the user logs in or launches the studio, they are transitioned cleanly
 * to the App Workspace (/app or app subdomain).
 */
export default function PresentationPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleOpenStudio = () => {
    if (isLoggedIn) {
      router.push("/app");
    } else {
      router.push("/app");
    }
  };

  const handleOpenLogin = () => {
    if (isLoggedIn) {
      router.push("/app");
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <>
      <Landing
        onOpenStudio={handleOpenStudio}
        onOpenLogin={handleOpenLogin}
        onOpenPricing={() => setPricingOpen(true)}
      />

      {/* Quick Top-up / Pricing Modal */}
      <PricingModal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        currentCredits={25}
      />

      {/* Auth Modal (Sign in / Sign up) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
          router.push("/app");
        }}
      />

      {/* Toast notifications */}
      <ToastContainer />
    </>
  );
}
