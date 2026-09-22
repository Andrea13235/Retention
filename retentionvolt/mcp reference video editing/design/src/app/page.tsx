'use client';

import React, { useState, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { MobbinCategoryHero } from '@/components/MobbinCategoryHero';
import { FilterBar } from '@/components/FilterBar';
import { VideoCard } from '@/components/VideoCard';
import { VideoDetailModal } from '@/components/VideoDetailModal';
import { ThumbnailsSection } from '@/components/ThumbnailsSection';
import { PaywallModal } from '@/components/PaywallModal';
import { SettingsModal } from '@/components/SettingsModal';
import { Footer } from '@/components/Footer';
import { PublicProfileModal } from '@/components/PublicProfileModal';
import { RequestContentModal } from '@/components/RequestContentModal';
import { ChangelogModal } from '@/components/ChangelogModal';
import { BlogModal } from '@/components/BlogModal';
import { SupportModal } from '@/components/SupportModal';
import { CareersModal, MerchModal, LegalModal } from '@/components/CareersMerchLegalModals';
import { MobbinLandingView } from '@/components/MobbinLandingView';
import { MobbinAuthModal } from '@/components/MobbinAuthModal';
import { MobbinOnboardingModal } from '@/components/MobbinOnboardingModal';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { VIDEOS_DATA } from '@/data/videos';
import { VideoData } from '@/types';

export default function HomePage() {
  const { user, isLoggedIn, isLoading, onboardingCompleted, logout, updateProfile, refreshSession } = useAuth();
  const [activeView, setActiveView] = useState<'landing' | 'app'>('landing');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signup' | 'login'>('signup');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'videos' | 'thumbnails' | 'pricing'>('videos');
  const [activeSubTab, setActiveSubTab] = useState<'longs' | 'shorts'>('longs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedNiche, setSelectedNiche] = useState('all');
  const [selectedPacing, setSelectedPacing] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

  const [videos, setVideos] = useState<VideoData[]>(VIDEOS_DATA);

  // Live database sync: Fetch all latest analyzed videos from Supabase
  React.useEffect(() => {
    let isMounted = true;
    async function fetchLiveVideos() {
      try {
        const headers: Record<string, string> = {};
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        }
        const res = await fetch('/api/videos', { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            const merged = data.map((dVideo: VideoData) => {
              const localMatch = VIDEOS_DATA.find(v => v.youtubeId === dVideo.youtubeId || v.id === dVideo.id);
              if (localMatch) {
                return {
                  ...localMatch,
                  ...dVideo,
                  cuts: dVideo.cuts || [],
                  shots: dVideo.shots || [],
                  isLocked: Boolean(dVideo.isLocked),
                };
              }
              return dVideo;
            });
            setVideos(merged);
          }
        }
      } catch (err) {
        console.warn('Using offline benchmark dataset:', err);
      }
    }
    fetchLiveVideos();
    return () => { isMounted = false; };
  }, [user]);

  // Listen for Stripe redirect success / cancel.
  // On success we RE-READ the live session (plan is webhook-written, never
  // client-set). The webhook may lag a few seconds, so retry briefly before
  // concluding.
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('upgrade') === 'success') {
        setActiveView('app');
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        setToastMessage('Confirming your subscription…');
        (async () => {
          let livePlan: 'free' | 'pro' | null = null;
          for (let attempt = 0; attempt < 6; attempt++) {
            livePlan = await refreshSession();
            if (livePlan === 'pro') break;
            await new Promise(r => setTimeout(r, 2000));
          }
          if (livePlan === 'pro') {
            setToastMessage('🎉 Subscription active! Welcome to RETENTIONVOLT Pro.');
          } else {
            setToastMessage('Payment received — your Pro status is activating (webhook pending). If it takes more than a minute, contact support.');
          }
          setTimeout(() => setToastMessage(null), 6000);
        })();
      } else if (params.get('upgrade') === 'cancel') {
        setToastMessage('Stripe checkout cancelled.');
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        setTimeout(() => setToastMessage(null), 3000);
      }

      const authParam = params.get('auth');
      if (authParam === 'login' || authParam === 'signup') {
        setAuthModalMode(authParam);
        setIsAuthModalOpen(true);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [refreshSession]);

  // When user is authenticated, open the App view and direct to onboarding if needed
  React.useEffect(() => {
    if (!isLoading && isLoggedIn) {
      if (activeView === 'landing') {
        setActiveView('app');
      }
      if (!onboardingCompleted) {
        setIsOnboardingOpen(true);
      }
    }
  }, [isLoggedIn, isLoading, onboardingCompleted, activeView]);

  // Strict auth guard: Unauthenticated users cannot access the app view without signing up
  React.useEffect(() => {
    if (!isLoading && !isLoggedIn && activeView === 'app') {
      setActiveView('landing');
      handleOpenAuth('signup');
    }
  }, [isLoading, isLoggedIn, activeView]);

  // Modals state
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'account' | 'preferences' | 'billing' | 'team' | 'mcp'>('account');

  // Profile Popover Connected Modals State
  const [isProfileSetupOpen, setIsProfileSetupOpen] = useState(false);
  const [isRequestContentOpen, setIsRequestContentOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isBlogOpen, setIsBlogOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isCareersOpen, setIsCareersOpen] = useState(false);
  const [isMerchOpen, setIsMerchOpen] = useState(false);
  const [legalModalState, setLegalModalState] = useState<{ isOpen: boolean; tab: 'privacy' | 'terms' | 'copyright' }>({
    isOpen: false,
    tab: 'privacy'
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const openSettings = (tab: 'account' | 'preferences' | 'billing' | 'team' | 'mcp' = 'account') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const handleOpenAuth = (mode: 'signup' | 'login' = 'signup') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    setActiveView('app');
    if (!onboardingCompleted) {
      setIsOnboardingOpen(true);
    } else {
      setToastMessage(`Welcome back${user?.name ? ', ' + user.name : ''}!`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleOnboardingFinished = () => {
    setIsOnboardingOpen(false);
    setActiveView('app');
    setToastMessage(`🎉 Profile setup complete! Welcome to RETENTIONVOLT${user?.name ? ', ' + user.name : ''}`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogout = async () => {
    await logout();
    setActiveView('landing');
    setToastMessage('Logged out successfully. Profile session cleared.');
    setTimeout(() => setToastMessage(null), 3000);
  };


  // Filtered and sorted videos
  const filteredVideos = useMemo(() => {
    let result = videos.filter((video) => {
      // 1. Separate Longs vs Shorts
      if (activeSubTab === 'shorts') {
        if (video.aspectRatio !== '9:16' && video.category !== 'shorts') return false;
      } else {
        if (video.aspectRatio === '9:16' || video.category === 'shorts') return false;
      }

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = video.title.toLowerCase().includes(q);
        const matchCreator = video.creator.name.toLowerCase().includes(q);
        const matchNiche = video.niche.toLowerCase().includes(q);
        const matchTags = video.tags.some(t => t.toLowerCase().includes(q));
        if (!matchTitle && !matchCreator && !matchNiche && !matchTags) {
          return false;
        }
      }

      // 3. Category format filter
      if (selectedCategory !== 'all' && video.category !== selectedCategory) {
        return false;
      }

      // 4. Horizontal Categories Niche filter
      if (selectedNiche !== 'all' && video.niche !== selectedNiche) {
        return false;
      }

      // 5. Pacing filter
      if (selectedPacing === 'hyper' && video.cpm <= 25) return false;
      if (selectedPacing === 'moderate' && (video.cpm < 14 || video.cpm > 25)) return false;
      if (selectedPacing === 'cinematic' && video.cpm >= 14) return false;

      return true;
    });

    // Default sorting by retention score
    result.sort((a, b) => b.retentionScore - a.retentionScore);

    return result;
  }, [videos, searchQuery, selectedCategory, selectedNiche, selectedPacing, sortBy, activeSubTab]);

  // Count longs vs shorts available in current videos dataset
  const { longsCount, shortsCount } = useMemo(() => {
    let longs = 0;
    let shorts = 0;
    for (const v of videos) {
      if (v.aspectRatio === '9:16' || v.category === 'shorts') {
        shorts++;
      } else {
        longs++;
      }
    }
    return { longsCount: longs, shortsCount: shorts };
  }, [videos]);

  // Check if search has matches in the OTHER tab
  const searchMatchesInOtherTab = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    const q = searchQuery.toLowerCase();
    const otherTargetIsShorts = activeSubTab === 'longs';
    return videos.filter((video) => {
      const isShort = video.aspectRatio === '9:16' || video.category === 'shorts';
      if (otherTargetIsShorts ? !isShort : isShort) return false;
      const matchTitle = video.title.toLowerCase().includes(q);
      const matchCreator = video.creator.name.toLowerCase().includes(q);
      const matchNiche = video.niche.toLowerCase().includes(q);
      const matchTags = video.tags.some(t => t.toLowerCase().includes(q));
      return matchTitle || matchCreator || matchNiche || matchTags;
    }).length;
  }, [videos, searchQuery, activeSubTab]);

  // Reset everything to home: all videos, no filters
  const resetToHome = () => {
    setActiveTab('videos');
    setSelectedNiche('all');
    setSelectedCategory('all');
    setSelectedPacing('all');
    setSearchQuery('');
    setActiveSubTab('longs');
  };

  // If in landing mode, render Mobbin Landing Page
  if (activeView === 'landing') {
    return (
      <div className="min-h-screen flex flex-col bg-[#0b0b0b] text-white font-sans antialiased">
        <MobbinLandingView
          onJoinForFree={() => handleOpenAuth('signup')}
          onLogin={() => handleOpenAuth('login')}
          onSeePlans={() => setIsPaywallOpen(true)}
          onExploreLibrary={() => handleOpenAuth('signup')}
          onSelectVideo={() => handleOpenAuth('signup')}
        />

        {/* Global Inspector Modal */}
        <VideoDetailModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onOpenPaywall={() => setIsPaywallOpen(true)}
          onOpenMcp={() => openSettings('mcp')}
        />

        {/* Global Paywall Modal */}
        <PaywallModal
          isOpen={isPaywallOpen}
          onClose={() => setIsPaywallOpen(false)}
          onOpenAuth={() => handleOpenAuth('signup')}
        />

        {/* Mobbin Auth Modal */}
        <MobbinAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
          initialMode={authModalMode}
        />

        {/* Mobbin 3-Step Onboarding Modal */}
        <MobbinOnboardingModal
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onFinished={handleOnboardingFinished}
        />

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#222222] border border-[#383838] text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-[#d1fe17]" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0e0e0e] text-white font-sans antialiased">
      
      {/* 1. Mobbin Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeView={activeView}
        onViewChange={setActiveView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenSettings={() => openSettings('account')}
        onOpenPaywall={() => setIsPaywallOpen(true)}
        onOpenMcp={() => openSettings('mcp')}
        onLogoClick={resetToHome}
        onOpenAuth={handleOpenAuth}
        onOpenProfileSetup={() => setIsProfileSetupOpen(true)}
        onOpenRequestContent={() => setIsRequestContentOpen(true)}
        onOpenChangelog={() => setIsChangelogOpen(true)}
        onOpenBlog={() => setIsBlogOpen(true)}
        onOpenCareers={() => setIsCareersOpen(true)}
        onOpenMerch={() => setIsMerchOpen(true)}
        onOpenSupport={() => setIsSupportOpen(true)}
        onOpenLegal={(tab) => setLegalModalState({ isOpen: true, tab })}
        onLogout={handleLogout}
      />


      {/* Main Page Area */}
      <main className="flex-1 w-full">
        
        {/* VIEW 1: VIDEOS (Matching Mobbin discover/sites/latest exactly) */}
        {activeTab === 'videos' && (
          <div>
            
            {/* 2. Mobbin Horizontal Categories Row */}
            <MobbinCategoryHero
              selectedNiche={selectedNiche}
              onSelectNiche={(niche) => setSelectedNiche(niche)}
            />

            {/* 3. Mobbin Subbar (Latest / Most Popular / Filter) + Pro Banner */}
            <FilterBar
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedNiche={selectedNiche}
              setSelectedNiche={setSelectedNiche}
              selectedPacing={selectedPacing}
              setSelectedPacing={setSelectedPacing}
              sortBy={sortBy}
              setSortBy={setSortBy}
              activeSubTab={activeSubTab}
              setActiveSubTab={setActiveSubTab}
              longsCount={longsCount}
              shortsCount={shortsCount}
              onOpenPaywall={() => setIsPaywallOpen(true)}
            />

            {/* 4. Mobbin Card Grid: Longs (3 cols widescreen) vs Shorts (4-5 cols mobile portrait) */}
            <div className="max-w-[1800px] mx-auto px-4 sm:px-8 py-8">
              {/* Smart Cross-Tab Search Recommendation Banner */}
              {searchMatchesInOtherTab > 0 && (
                <div className="mb-6 p-4 rounded-2xl bg-[#161616] border border-[#2e2e2e] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#ccc]">
                    <span className="text-base">⚡</span>
                    <span>
                      Trovati <strong>{searchMatchesInOtherTab}</strong> {activeSubTab === 'longs' ? 'Shorts' : 'video Long-form'} per &quot;{searchQuery}&quot; nella sezione {activeSubTab === 'longs' ? 'Shorts' : 'Long-form'}.
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveSubTab(activeSubTab === 'longs' ? 'shorts' : 'longs')}
                    className="px-4 py-1.5 rounded-full bg-[#d1fe17] text-black text-xs font-bold hover:bg-[#bce415] transition-all shrink-0 shadow-md"
                  >
                    Passa a {activeSubTab === 'longs' ? 'Shorts' : 'Longs'} ({searchMatchesInOtherTab}) →
                  </button>
                </div>
              )}
              {filteredVideos.length > 0 ? (
                <div className={
                  activeSubTab === 'shorts'
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 sm:gap-6"
                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10"
                }>
                  {filteredVideos.map((video, idx) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      index={idx}
                      onSelect={(v) => setSelectedVideo(v)}
                      onOpenPaywall={() => setIsPaywallOpen(true)}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-20 text-center space-y-3">
                  <h3 className="text-base font-bold text-white">
                    No {activeSubTab === 'shorts' ? 'Shorts' : 'Long-form'} references found
                  </h3>
                  <p className="text-xs text-[#8e8e8e]">
                    Try resetting your category filters or search keywords.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setSelectedNiche('all');
                      setSelectedPacing('all');
                    }}
                    className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-neutral-200"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* VIEW 2: THUMBNAILS VAULT */}
        {activeTab === 'thumbnails' && (
          <div className="max-w-[1800px] mx-auto px-4 sm:px-8 py-6">
            <ThumbnailsSection
              onOpenPaywall={() => setIsPaywallOpen(true)}
              onOpenMcp={() => openSettings('mcp')}
            />
          </div>
        )}

        {/* VIEW 3: PRICING TAB */}
        {activeTab === 'pricing' && (
          <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide uppercase">
              Creator Pro &amp; Starter Free
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              RETENTIONVOLT Pricing
            </h1>
            <p className="text-sm sm:text-base text-[#8e8e8e] max-w-xl mx-auto">
              Pro includes everything: 500,000+ video cut cadences, DaVinci/Premiere EDL exports, and full CyberMCP server remote access for AI agents.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsPaywallOpen(true)}
                className="px-6 py-3 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all shadow-lg hover:shadow-white/10"
              >
                View Plans &amp; Start 7-Day Free Trial →
              </button>
              <a
                href="/pricing"
                className="px-6 py-3 rounded-full bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-white font-semibold text-xs transition-colors"
              >
                Open Full Comparison Page
              </a>
            </div>
          </div>
        )}

      </main>

      {/* Global Inspector Modal */}
      <VideoDetailModal
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onOpenPaywall={() => setIsPaywallOpen(true)}
        onOpenMcp={() => openSettings('mcp')}
      />

      {/* Global Paywall Modal */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        onOpenAuth={() => handleOpenAuth('signup')}
      />

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenPaywall={() => setIsPaywallOpen(true)}
        initialTab={settingsInitialTab}
      />

      {/* Global Footer */}
      <Footer
        onOpenSettings={() => openSettings('account')}
        onOpenPaywall={() => setIsPaywallOpen(true)}
        onOpenLegal={(tab) => setLegalModalState({ isOpen: true, tab })}
        setActiveTab={setActiveTab}
      />

      {/* Public Profile Onboarding Modal */}
      <PublicProfileModal
        isOpen={isProfileSetupOpen}
        onClose={() => setIsProfileSetupOpen(false)}
        onOpenAccountSettings={() => openSettings('account')}
      />

      {/* Request Content 2-Step Modal */}
      <RequestContentModal
        isOpen={isRequestContentOpen}
        onClose={() => setIsRequestContentOpen(false)}
      />

      {/* Changelog Modal */}
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
        onOpenMcp={() => openSettings('mcp')}
      />

      {/* Blog Modal */}
      <BlogModal
        isOpen={isBlogOpen}
        onClose={() => setIsBlogOpen(false)}
      />

      {/* Support Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Careers Modal */}
      <CareersModal
        isOpen={isCareersOpen}
        onClose={() => setIsCareersOpen(false)}
      />

      {/* Merch Modal */}
      <MerchModal
        isOpen={isMerchOpen}
        onClose={() => setIsMerchOpen(false)}
      />

      {/* Legal Modal (Privacy, Terms, Copyright) */}
      <LegalModal
        isOpen={legalModalState.isOpen}
        initialTab={legalModalState.tab}
        onClose={() => setLegalModalState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Mobbin Auth Modal */}
      <MobbinAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      {/* Mobbin 3-Step Onboarding Modal */}
      <MobbinOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onFinished={handleOnboardingFinished}
        onOpenPaywall={() => setIsPaywallOpen(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#222222] border border-[#383838] text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#d1fe17]" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>

  );
}
