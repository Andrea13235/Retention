import React from "react";

export function Brand({
  compact = false,
  variant = "default",
  size = "md",
}: {
  compact?: boolean;
  variant?: "default" | "volt";
  size?: "sm" | "md" | "lg";
}) {
  const isVolt = variant === "volt";
  const name = isVolt ? "RETENTIONEDIT" : "RetentionEdit";

  const markSize =
    size === "lg"
      ? "w-14 h-14 rounded-2xl text-2xl font-black"
      : size === "sm"
      ? "w-6 h-6 rounded-md text-xs font-black"
      : "w-7 h-7 rounded-lg text-sm font-black";

  return (
    <span className="brand flex items-center gap-2.5 select-none">
      <span
        className={`brand-mark ${markSize} flex items-center justify-center shrink-0 tracking-tighter shadow-sm transition-transform ${
          isVolt
            ? "bg-[#d1fe17] text-black font-black shadow-[#d1fe17]/20 shadow-md"
            : "bg-white text-black"
        }`}
        aria-hidden="true"
      >
        {isVolt ? (
          <span className="font-extrabold leading-none tracking-tight">R</span>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-4 h-4"
            width="16"
            height="16"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
          </svg>
        )}
      </span>
      {!compact && (
        <span
          className={`brand-name font-black tracking-tight text-white flex items-center ${
            isVolt ? "text-base tracking-wider uppercase font-black" : "text-[15px]"
          }`}
        >
          {name}
        </span>
      )}
    </span>
  );
}

