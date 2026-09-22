'use client';

import React from 'react';

interface RetentionvoltLogoProps {
  variant?: 
    | 'icon' 
    | 'full' 
    | 'pill' 
    | 'mark-b' 
    | 'ribbon' 
    | 'ribbon-dark' 
    | 'ribbon-full'
    | 'ribbon-red'
    | 'ribbon-red-black'
    | 'ribbon-red-dark'
    | 'ribbon-red-full'
    | 'soft-wave'
    | 'soft-wave-ytred'
    | 'soft-wave-dark';
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showGlow?: boolean;
}

export const RetentionvoltLogo: React.FC<RetentionvoltLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  showGlow = true,
}) => {
  // Dimensions map
  const sizeConfig = {
    sm: { icon: 22, text: 'text-sm', badge: 'text-[10px] px-1.5 py-0.5' },
    md: { icon: 28, text: 'text-base', badge: 'text-[11px] px-2 py-0.5' },
    lg: { icon: 36, text: 'text-xl', badge: 'text-xs px-2.5 py-1' },
    xl: { icon: 48, text: 'text-2xl', badge: 'text-sm px-3 py-1' },
  };

  const dim = typeof size === 'number' ? size : sizeConfig[size].icon;
  const textClass = typeof size === 'string' ? sizeConfig[size].text : 'text-base';

  // Mark A: The Velocity Cut (Monogram R with Razor Cut & Retention Wave)
  const renderIconMarkA = () => (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200 group-hover:scale-105"
    >
      <defs>
        <linearGradient id="rv-lime-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8FF59" />
          <stop offset="100%" stopColor="#D1FE17" />
        </linearGradient>
        {showGlow && (
          <filter id="rv-retention-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#D1FE17" floodOpacity="0.45" />
          </filter>
        )}
      </defs>

      {/* Dark chassis */}
      <rect
        width="40"
        height="40"
        rx="9"
        fill="#121318"
        stroke="rgba(255, 255, 255, 0.14)"
        strokeWidth="1.2"
      />

      {/* Left Timeline Stem with 45° Razor Cut gap */}
      <path
        d="M 10 9 C 10 7.895 10.895 7 12 7 H 14 C 15.105 7 16 7.895 16 9 V 17 L 10 21 Z"
        fill="#FFFFFF"
      />
      <path
        d="M 10 24 L 16 20 V 31 C 16 32.105 15.105 33 14 33 H 12 C 10.895 33 10 32.105 10 31 Z"
        fill="#FFFFFF"
      />

      {/* Upper Loop (The Hook) */}
      <path
        d="M 16 8.5 H 23 C 27.142 8.5 30.5 11.858 30.5 16 C 30.5 20.142 27.142 23.5 23 23.5 H 17.5"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The Retention Curve (Electric Neon Kick) */}
      <path
        d="M 19 20.5 C 21.5 20.5 23 23 24 26 C 24.8 28.4 26.5 31.5 31 31.5"
        stroke="url(#rv-lime-grad)"
        strokeWidth="3.6"
        strokeLinecap="round"
        filter={showGlow ? "url(#rv-retention-glow)" : undefined}
      />

      {/* Keyframe Anchor Node */}
      <circle cx="31" cy="31.5" r="2.1" fill="#D1FE17" />
    </svg>
  );

  // Mark B: The Geometric Razor Bin
  const renderIconMarkB = () => (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200 group-hover:scale-105"
    >
      <defs>
        <linearGradient id="rv-b-lime" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E5FF55" />
          <stop offset="100%" stopColor="#D1FE17" />
        </linearGradient>
        {showGlow && (
          <filter id="rv-glow-b" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#D1FE17" floodOpacity="0.4" />
          </filter>
        )}
      </defs>

      <rect width="44" height="44" rx="10" fill="#0C0D11" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.2" />
      <path d="M 12 8 H 34 C 35.657 8 37 9.343 37 11 V 21" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="33" y1="10" x2="11" y2="32" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
      <path d="M 8 21 V 33 C 8 34.657 9.343 36 11 36 H 24" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M 10 34 C 13 34 14 26 17 24 C 20 22 23 29 27 29 C 29.5 29 32 27.5 34 25"
        stroke="url(#rv-b-lime)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={showGlow ? "url(#rv-glow-b)" : undefined}
      />
      <circle cx="34" cy="25" r="2" fill="#D1FE17" />
    </svg>
  );

  // Mark C: The Higgsfield-style Continuous Ribbon R with Multi-Palette support
  const renderIconRibbon = (mode: 'lime' | 'dark' | 'red' | 'red-black' | 'red-dark' = 'lime') => {
    let bgColor = '#D1FE17';
    let strokeColor = '#000000';
    let hasBorder = false;
    let glowFilter = '';

    if (mode === 'dark') {
      bgColor = '#0C0D11';
      strokeColor = '#D1FE17';
      hasBorder = true;
    } else if (mode === 'red') {
      bgColor = '#FF0000';
      strokeColor = '#FFFFFF';
    } else if (mode === 'red-black') {
      bgColor = '#FF0000';
      strokeColor = '#000000';
    } else if (mode === 'red-dark') {
      bgColor = '#0C0D11';
      strokeColor = '#FF0000';
      hasBorder = true;
    }

    return (
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
      >
        <rect
          width="512"
          height="512"
          rx="112"
          fill={bgColor}
          stroke={hasBorder ? 'rgba(255, 255, 255, 0.12)' : 'none'}
          strokeWidth={hasBorder ? '8' : '0'}
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
  };

  // Mark D: The Soft Serpentine Spline R (Higgsfield Organic Waves)
  const renderIconSoftWave = (mode: 'lime' | 'ytred' | 'dark' = 'lime') => {
    const bgColor = mode === 'dark' ? '#0C0D11' : mode === 'ytred' ? '#FF0000' : '#D1FE17';
    const strokeColor = mode === 'dark' ? '#D1FE17' : mode === 'ytred' ? '#FFFFFF' : '#000000';
    const hasBorder = mode === 'dark';

    return (
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
      >
        <rect
          width="512"
          height="512"
          rx="112"
          fill={bgColor}
          stroke={hasBorder ? 'rgba(255, 255, 255, 0.12)' : 'none'}
          strokeWidth={hasBorder ? '8' : '0'}
        />
        <path
          d="M 140 415 C 180 370 175 270 145 200 C 130 140 185 95 260 95 C 340 95 385 140 385 210 C 385 280 320 315 220 315"
          stroke={strokeColor}
          strokeWidth="50"
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
        <path
          d="M 220 315 C 275 315 305 345 330 385 C 350 420 380 435 415 422"
          stroke={strokeColor}
          strokeWidth="50"
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (variant === 'icon') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconRibbon('lime')}</div>;
  }

  if (variant === 'soft-wave') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconSoftWave('lime')}</div>;
  }

  if (variant === 'soft-wave-ytred') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconSoftWave('ytred')}</div>;
  }

  if (variant === 'soft-wave-dark') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconSoftWave('dark')}</div>;
  }

  if (variant === 'ribbon') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconRibbon('lime')}</div>;
  }

  if (variant === 'ribbon-dark') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconRibbon('dark')}</div>;
  }

  if (variant === 'ribbon-red') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconRibbon('red')}</div>;
  }

  if (variant === 'ribbon-red-black') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconRibbon('red-black')}</div>;
  }

  if (variant === 'ribbon-red-dark') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconRibbon('red-dark')}</div>;
  }

  if (variant === 'mark-b') {
    return <div className={`inline-flex items-center ${className}`}>{renderIconMarkB()}</div>;
  }

  if (variant === 'pill') {
    return (
      <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
        {renderIconRibbon('lime')}
        <div className="flex items-center gap-1.5 tracking-tight">
          <span className={`font-extrabold ${textClass} text-white tracking-[-0.03em]`}>
            RETENTIONVOLT
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'ribbon-red-full') {
    return (
      <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
        {renderIconRibbon('red')}
        <div className="flex items-center tracking-tight">
          <span className={`font-extrabold ${textClass} text-white tracking-[-0.03em]`}>
            RETENTION
          </span>
          <span className={`font-extrabold ${textClass} text-[#FF0000] tracking-[-0.03em] drop-shadow-[0_0_8px_rgba(255,0,0,0.4)]`}>
            VOLT
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'ribbon-full') {
    return (
      <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
        {renderIconRibbon('lime')}
        <div className="flex items-center tracking-tight">
          <span className={`font-extrabold ${textClass} text-white tracking-[-0.03em]`}>
            RETENTION
          </span>
          <span className={`font-extrabold ${textClass} text-[#d1fe17] tracking-[-0.03em] drop-shadow-[0_0_8px_rgba(209,254,23,0.3)]`}>
            VOLT
          </span>
        </div>
      </div>
    );
  }

  // Default: 'full' lockup
  return (
    <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      {renderIconRibbon('lime')}
      <div className="flex items-center tracking-tight">
        <span className={`font-extrabold ${textClass} text-white tracking-[-0.03em]`}>
          RETENTION
        </span>
        <span className={`font-extrabold ${textClass} text-[#d1fe17] tracking-[-0.03em] drop-shadow-[0_0_8px_rgba(209,254,23,0.3)]`}>
          VOLT
        </span>
      </div>
    </div>
  );
};
