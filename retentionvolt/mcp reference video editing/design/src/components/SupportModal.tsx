'use client';

import React, { useState, useEffect } from 'react';
import { X, HelpCircle, Mail, MessageSquare, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FAQS = [
  {
    q: 'How do I connect the MCP Server to Codex or Cursor?',
    a: 'Go to Settings > MCP Server. Copy either the one-line Codex CLI command (`codex mcp add retentionvolt ...`) or the JSON configuration block and paste it into your ~/.cursor/mcp.json or codex.json file.'
  },
  {
    q: 'How is the Retention Score calculated?',
    a: 'Our neural pipeline evaluates 4 distinct dimensions: 0-30s hook velocity, cut cadence (CPM vs niche benchmark), speech dynamism (WPM), and thumbnail contrast ratio.'
  },
  {
    q: 'Can I export motion graphic code to Remotion or After Effects?',
    a: 'Yes! In the Motion Graphics section, open any pattern (MG-001 through MG-006) and click "Copy Remotion Code" or "Copy CSS Keyframes" to drop it directly into your video composition.'
  },
  {
    q: 'What is included in the PRO Subscription?',
    a: 'PRO members get unlimited library access, full CyberMCP server connectivity, unrestricted video breakdowns beyond the 4 latest references, and thumbnail prompt generator recipes.'
  }
];

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('mcp');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubject('');
      setCategory('mcp');
      setMessage('');
      setEmail('');
      setSent(false);
      setSending(false);
      setSendError(null);
      setActiveFaq(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    setSending(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, category, message, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setSent(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      setSendError(err?.message || 'Send failed — try support@retentionvolt.com');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div 
        className="relative w-full max-w-2xl bg-[#141414] text-white rounded-3xl border border-[#262626] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        style={{ boxShadow: '0 25px 70px -15px rgba(0,0,0,0.9), 0 0 1px 1px rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#222222] bg-[#171717] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-[#d1fe17]">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Help &amp; Support</h2>
              <p className="text-xs text-[#8e8e8e]">
                Direct assistance, MCP server setup help, and frequent questions.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {sent ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center mb-4">
                <Check className="w-6 h-6 text-[#10b981]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Message Received!</h3>
              <p className="text-xs text-[#8e8e8e] max-w-sm">
                Your ticket is logged — we reply within 2 business hours at the email you provided.
              </p>
            </div>
          ) : (
            <>
              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 bg-[#1b1b1b] p-5 rounded-2xl border border-[#262626]">
                <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
                  <Mail className="w-4 h-4 text-[#d1fe17]" />
                  <span>Send a priority inquiry to engineering</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#8e8e8e] mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-[#242424] text-white text-xs rounded-xl border border-[#333] focus:outline-none focus:border-[#555]"
                    >
                      <option value="mcp">MCP Server &amp; Codex Integration</option>
                      <option value="billing">Plan &amp; Billing Inquiry</option>
                      <option value="bug">Video Analysis / Pacing Bug</option>
                      <option value="feature">Custom Video Request</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#8e8e8e] mb-1">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                      placeholder="Brief summary..."
                      className="w-full px-3 py-2 bg-[#242424] text-white text-xs rounded-xl border border-[#333] focus:outline-none focus:border-[#555] placeholder-[#666]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#8e8e8e] mb-1">Details</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={3}
                    placeholder="Describe your question or issue in detail..."
                    className="w-full px-3 py-2 bg-[#242424] text-white text-xs rounded-xl border border-[#333] focus:outline-none focus:border-[#555] placeholder-[#666] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#8e8e8e] mb-1">Your email (for the reply)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    className="w-full px-3 py-2 bg-[#242424] text-white text-xs rounded-xl border border-[#333] focus:outline-none focus:border-[#555] placeholder-[#666]"
                  />
                </div>

                {sendError && (
                  <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    {sendError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-[#666] leading-tight max-w-[60%]">
                    Inviando accetti <a href="/privacy" className="underline hover:text-white">Privacy</a> e <a href="/terms" className="underline hover:text-white">Termini</a>. Rispondiamo all’email fornita.
                  </span>
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-5 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-[#e0e0e0] transition-colors disabled:opacity-60"
                  >
                    {sending ? 'Sending…' : 'Send Message'}
                  </button>
                </div>
              </form>

              {/* FAQs Accordion */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e8e8e] mb-3">
                  Frequently Asked Questions
                </h3>
                <div className="space-y-2">
                  {FAQS.map((faq, idx) => {
                    const isExpanded = activeFaq === idx;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl bg-[#191919] border border-[#262626] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setActiveFaq(isExpanded ? null : idx)}
                          className="w-full px-4 py-3 text-left flex items-center justify-between text-xs font-semibold text-white hover:bg-[#202020] transition-colors"
                        >
                          <span>{faq.q}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#8e8e8e] shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#8e8e8e] shrink-0" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-3 text-xs text-[#a3a3a3] leading-relaxed border-t border-[#262626]/50 pt-2.5">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#222222] bg-[#171717] flex items-center justify-between text-xs text-[#8e8e8e] shrink-0">
          <span>Need real-time assistance? Contact support@retentionvolt.com</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-[#272727] hover:bg-[#333] text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
