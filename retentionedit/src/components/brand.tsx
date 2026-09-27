"use client";

import React from "react";

interface BrandProps {
  compact?: boolean;
  variant?: "default" | "volt" | "dark" | "icon" | "full";
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  showGlow?: boolean;
}

export function RetentionRibbonIcon({
  size = 28,
  mode = "lime",
  className = "",
}: {
  size?: number;
  mode?: "lime" | "dark";
  className?: string;
}) {
  const isDark = mode === "dark";
  const bgColor = isDark ? "#0C0D11" : "#D1FE17";
  const strokeColor = isDark ? "#D1FE17" : "#000000";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 group-hover:scale-105 ${className}`}
      aria-label="Retention Logo"
    >
      <rect
        width="512"
        height="512"
        rx="112"
        fill={bgColor}
        stroke={isDark ? "rgba(255, 255, 255, 0.14)" : "none"}
        strokeWidth={isDark ? "8" : "0"}
      />
      <path
        d="M 125 418 V 206 C 125 131 175 96 245 96 C 315 96 365 141 365 211 C 365 276 315 311 240 311 H 125"
        stroke={strokeColor}
        strokeWidth="52"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d="M 235 311 C 265 311 295 346 325 396 C 342 424 365 434 395 426"
        stroke={strokeColor}
        strokeWidth="52"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({
  compact = false,
  variant = "default",
  size = "md",
  className = "",
  showGlow = true,
}: BrandProps) {
  // Dimensions map matching RetentionVolt's design system
  const sizeMap: Record<string, { icon: number; text: string }> = {
    xs: { icon: 20, text: "text-xs tracking-tight" },
    sm: { icon: 24, text: "text-sm tracking-tight" },
    md: { icon: 30, text: "text-[16px] tracking-tight" },
    lg: { icon: 40, text: "text-xl tracking-tight" },
    xl: { icon: 52, text: "text-2xl tracking-tight" },
  };

  const dim =
    typeof size === "number"
      ? size
      : sizeMap[size]?.icon ?? 30;

  const textClass =
    typeof size === "string"
      ? sizeMap[size]?.text ?? "text-[16px]"
      : "text-[16px]";

  const isDarkMark = variant === "dark";

  return (
    <span
      className={`brand inline-flex items-center gap-2.5 select-none group cursor-pointer ${className}`}
    >
      {/* Official RetentionVolt Pure Ribbon R Icon */}
      <RetentionRibbonIcon
        size={dim}
        mode={isDarkMark ? "dark" : "lime"}
      />

      {/* Lockup Text: RETENTION EDIT */}
      {!compact && (
        <span
          className={`brand-name flex items-center font-black leading-none ${textClass}`}
        >
          <span className="text-white tracking-[-0.03em] font-black">
            RETENTION
          </span>
          <span
            className={`text-[#D1FE17] tracking-[-0.03em] font-black ml-1.5 ${
              showGlow ? "drop-shadow-[0_0_8px_rgba(209,254,23,0.35)]" : ""
            }`}
          >
            EDIT
          </span>
        </span>
      )}
    </span>
  );
}

export { Brand as RetentionLogo };
