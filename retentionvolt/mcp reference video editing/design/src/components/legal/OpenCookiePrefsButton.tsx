'use client';

import React from 'react';

export function OpenCookiePrefsButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rb:open-cookie-prefs'));
      }}
      className={className}
    >
      {children}
    </button>
  );
}
