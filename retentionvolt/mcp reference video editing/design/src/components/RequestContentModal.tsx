'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Check, Smartphone, Monitor, Palette, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface RequestContentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_CREATORS = [
  { name: 'MrBeast', category: 'High-Pacing Entertainment', icon: '⚡' },
  { name: 'Ali Abdaal', category: 'Productivity & Education', icon: '📚' },
  { name: 'MKBHD', category: 'Cinematic Tech Reviews', icon: '🎥' },
  { name: 'Colin and Samir', category: 'Creator Economy & Interviews', icon: '🎙️' },
  { name: 'The Diary Of A CEO', category: 'Deep Long-form Conversations', icon: '🧠' },
  { name: 'Iman Gadzhi', category: 'High-Budget Docustyle', icon: '💎' },
  { name: 'Cleo Abram', category: 'Optimistic Science & Tech', icon: '🚀' },
  { name: 'Tom Scott', category: 'Location Storytelling', icon: '📍' },
  { name: 'Zack D. Films', category: '3D Simulation Shorts', icon: '🎬' },
  { name: 'Nas Daily', category: '1-Minute Rapid Pacing', icon: '🌍' },
];

export const RequestContentModal: React.FC<RequestContentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState('');
  const [selectedCreator, setSelectedCreator] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'shorts' | 'longs' | 'motion'>('longs');
  const [notes, setNotes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setQuery('');
      setSelectedCreator('');
      setSelectedType('longs');
      setNotes('');
      setShowSuggestions(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredSuggestions = SAMPLE_CREATORS.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (name: string) => {
    setSelectedCreator(name);
    setQuery(name);
    setShowSuggestions(false);
  };

  const handleContinue = () => {
    if (!query.trim() && !selectedCreator) return;
    if (!selectedCreator) {
      setSelectedCreator(query.trim());
    }
    setStep(2);
  };

  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'feature',
          subject: `Content Request: ${selectedCreator || query}`,
          message: `Type: ${selectedType}\nRequested Creator: ${selectedCreator || query}\nNotes: ${notes || 'None'}`,
          email: user?.email || 'guest@retentionvolt.com',
        })
      });
    } catch {
      // Continue to confirmation step on network error
    } finally {
      setSubmitting(false);
      setStep(3);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div 
        className="relative w-full max-w-[460px] bg-[#1a1a1a] text-white rounded-3xl border border-[#2b2b2b] shadow-2xl p-7 flex flex-col justify-between min-h-[480px]"
        style={{ boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9), 0 0 1px 1px rgba(255,255,255,0.06)' }}
      >
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between h-8 mb-2">
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
              title="Indietro"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: Search / Creator Input */}
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center text-center justify-center">
            {/* 3D Cube Icon Graphic matching Mobbin */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#2e2e2e] to-[#1e1e1e] border border-[#3e3e3e] flex items-center justify-center shadow-inner mb-5">
              <span className="text-2xl select-none">❔</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 leading-tight">
              Which video or creator should we feature?
            </h2>

            <p className="text-xs text-[#8e8e8e] mb-6">
              Search by channel name or enter a YouTube video URL.
            </p>

            <div className="w-full relative text-left">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedCreator(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Name or YouTube URL..."
                className="w-full px-4 py-3 bg-[#242424] hover:bg-[#282828] focus:bg-[#282828] text-white text-sm rounded-xl border border-[#333333] focus:border-[#555] focus:outline-none transition-all placeholder-[#666]"
                autoFocus
              />

              {/* Suggestions dropdown */}
              {showSuggestions && query.trim() && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 max-h-48 overflow-y-auto bg-[#242424] border border-[#383838] rounded-xl shadow-xl z-20 divide-y divide-[#303030]">
                  {filteredSuggestions.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handleSelect(item.name)}
                      className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-[#2e2e2e] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{item.icon}</span>
                        <div>
                          <div className="text-xs font-semibold text-white">{item.name}</div>
                          <div className="text-[10px] text-[#8e8e8e]">{item.category}</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#666]">Select</span>
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-[#777777] mt-2 px-1">
                Only one per request.
              </p>
            </div>

            <button
              onClick={handleContinue}
              disabled={!query.trim()}
              className="mt-6 w-full py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-[#e0e0e0] active:bg-[#ccc] disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md"
            >
              Continue
            </button>
          </div>
        )}

        {/* STEP 2: Content Type & Details */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col items-center text-center justify-center">
            {/* Selected chip */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#272727] border border-[#383838] text-xs font-semibold text-white mb-3">
              <Sparkles className="w-3 h-3 text-[#d1fe17]" />
              <span>{selectedCreator}</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-5 leading-tight">
              Select content type
            </h2>

            {/* 3 Choice Cards */}
            <div className="grid grid-cols-3 gap-2.5 w-full mb-4">
              <button
                type="button"
                onClick={() => setSelectedType('shorts')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all ${
                  selectedType === 'shorts'
                    ? 'bg-[#272727] border-[#d1fe17] text-white shadow-sm'
                    : 'bg-[#222222] border-[#2e2e2e] text-[#8e8e8e] hover:border-[#444] hover:text-white'
                }`}
              >
                <Smartphone className={`w-5 h-5 mb-2 ${selectedType === 'shorts' ? 'text-[#d1fe17]' : ''}`} />
                <span className="text-xs font-semibold">Shorts</span>
                <span className="text-[10px] text-[#666] mt-0.5">9:16 Vertical</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType('longs')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all ${
                  selectedType === 'longs'
                    ? 'bg-[#272727] border-[#d1fe17] text-white shadow-sm'
                    : 'bg-[#222222] border-[#2e2e2e] text-[#8e8e8e] hover:border-[#444] hover:text-white'
                }`}
              >
                <Monitor className={`w-5 h-5 mb-2 ${selectedType === 'longs' ? 'text-[#d1fe17]' : ''}`} />
                <span className="text-xs font-semibold">Long-form</span>
                <span className="text-[10px] text-[#666] mt-0.5">16:9 Video</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType('motion')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all ${
                  selectedType === 'motion'
                    ? 'bg-[#272727] border-[#d1fe17] text-white shadow-sm'
                    : 'bg-[#222222] border-[#2e2e2e] text-[#8e8e8e] hover:border-[#444] hover:text-white'
                }`}
              >
                <Palette className={`w-5 h-5 mb-2 ${selectedType === 'motion' ? 'text-[#d1fe17]' : ''}`} />
                <span className="text-xs font-semibold">Motion</span>
                <span className="text-[10px] text-[#666] mt-0.5">Assets &amp; Hooks</span>
              </button>
            </div>

            {/* Optional Textarea */}
            <div className="w-full text-left mb-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Did the video have specific editing techniques or pacing? Let us know (optional)..."
                rows={2}
                className="w-full px-3.5 py-2.5 bg-[#242424] text-white text-xs rounded-xl border border-[#333333] focus:border-[#555] focus:outline-none transition-all placeholder-[#666] resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-[#e0e0e0] active:bg-[#ccc] transition-all shadow-md"
            >
              Submit request
            </button>

            <p className="text-[11px] text-[#777777] mt-3">
              We will notify you by email if the content you requested gets updated.
            </p>
          </form>
        )}

        {/* STEP 3: Success Confirmation */}
        {step === 3 && (
          <div className="flex-1 flex flex-col items-center text-center justify-center py-6">
            <div className="w-14 h-14 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center mb-4">
              <Check className="w-7 h-7 text-[#10b981]" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Request submitted!
            </h2>

            <p className="text-xs text-[#a3a3a3] max-w-sm mb-6 leading-relaxed">
              Thank you! Our video intelligence pipeline has queued <span className="text-white font-semibold">{selectedCreator}</span> for pacing breakdown, speech analysis, and MCP ingestion.
            </p>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-[#e0e0e0] transition-all"
            >
              Done
            </button>
          </div>
        )}

        {/* Step Indicator Bar at Bottom */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <div className={`h-1 rounded-full transition-all duration-300 ${
            step >= 1 ? 'w-8 bg-white' : 'w-8 bg-[#333333]'
          }`} />
          <div className={`h-1 rounded-full transition-all duration-300 ${
            step >= 2 ? 'w-8 bg-white' : 'w-8 bg-[#333333]'
          }`} />
        </div>

      </div>
    </div>
  );
};
