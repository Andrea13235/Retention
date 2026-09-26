"use client";
import React, { useState } from "react";
import { X, Check, LogOut } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credits?: number;
  onOpenPricing?: () => void;
  userName?: string;
  userEmail?: string;
  onSaveProfile?: (name: string, email: string) => void;
  onLogout?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  userName = "Andrea Barretta",
  userEmail = "barrettaandrea03@gmail.com",
  onSaveProfile,
  onLogout,
}: SettingsModalProps) {
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveProfile?.(name, email);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
      alert("Account deletion requested. Your data has been scheduled for removal.");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      {/* Profile Modal Card matching Screenshot 2 */}
      <div className="relative w-full max-w-[490px] bg-[#1c1c1e] border border-[#2e2e32] rounded-2xl shadow-2xl p-6 sm:p-7 text-[#f4f4f6]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[#28282c] flex items-center justify-center text-[#8c8c90] hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Form Fields */}
        <div className="flex flex-col mt-2">
          {/* User Name */}
          <div className="pb-3 border-b border-[#2b2b2e]">
            <label className="block text-xs font-semibold text-[#8c8c90] mb-1.5">
              User Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSave}
              className="w-full bg-transparent text-sm sm:text-[15px] font-medium text-white focus:outline-none focus:text-white"
            />
          </div>

          {/* Email */}
          <div className="pt-3 pb-3 border-b border-[#2b2b2e]">
            <label className="block text-xs font-semibold text-[#8c8c90] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleSave}
              className="w-full bg-transparent text-sm sm:text-[15px] font-medium text-white focus:outline-none focus:text-white"
            />
          </div>

          {/* Teams */}
          <div className="pt-3 pb-4 border-b border-[#2b2b2e]">
            <label className="block text-xs font-semibold text-[#8c8c90] mb-1.5">
              Teams
            </label>
            <span className="block text-sm sm:text-[15px] text-[#f4f4f6]">
              Not in a team
            </span>
          </div>

          {/* Log Out */}
          <div className="pt-4 pb-4 border-b border-[#2b2b2e] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">
                Log Out
              </span>
              <p className="text-xs text-[#8c8c90] mt-0.5">
                Esci dalla sessione corrente su questo browser.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout?.();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#28282c] hover:bg-[#34343a] text-xs font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer flex items-center gap-1.5"
            >
              <LogOut size={13} />
              <span>Esci</span>
            </button>
          </div>

          {/* Delete Account */}
          <div className="pt-5 flex items-start justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">
                Delete Account
              </span>
              <p className="text-xs text-[#8c8c90] mt-1 max-w-[270px] leading-relaxed">
                Once you delete your account, your data, files, projects, and compositions will be gone forever.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDelete}
              className="text-[#e04343] hover:text-red-400 font-medium text-xs sm:text-[13px] transition cursor-pointer shrink-0 mt-0.5"
            >
              Delete Account
            </button>
          </div>
        </div>

        {/* Subtle Save Feedback */}
        {savedNotice && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
            <Check size={12} />
            <span>Profile saved</span>
          </div>
        )}
      </div>
    </div>
  );
}
