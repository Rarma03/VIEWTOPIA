'use client';

import React from 'react';
import styles from './TicketLogo.module.css';

interface TicketLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Viewtopia anime-title logo.
 *
 * Pure CSS + a tiny SVG mark. Uses the `Bungee` display font (loaded in the
 * root layout) for the chunky sticker-style letters typical of anime title
 * cards. Layered text-shadow gives the dual-color "split" effect, and a
 * sparkle pseudo-element pulses softly to add life.
 *
 * Props are kept identical to the previous SVG ticket logo so all call sites
 * (Navbar, Footer, etc.) continue to work without changes.
 */
export default function TicketLogo({ size = 38, showText = true, className = '' }: Readonly<TicketLogoProps>) {
  const markSize = Math.round(size * 0.95);
  const fontSize = Math.round(size * 0.62);

  return (
    <span
      className={`${styles.wrapper} ${className}`}
      style={{
        ['--logo-size' as string]: `${size}px`,
        ['--logo-font' as string]: `${fontSize}px`,
      }}
      aria-label="Viewtopia"
    >
      {/* Diamond play mark */}
      <span className={styles.mark} style={{ width: markSize, height: markSize }}>
        <svg viewBox="0 0 40 40" width={markSize} height={markSize} aria-hidden="true">
          <defs>
            <linearGradient id="vt-mark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff3d71" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#00d4ff" />
            </linearGradient>
          </defs>
          {/* Rounded diamond */}
          <path
            d="M20 2 L38 20 L20 38 L2 20 Z"
            fill="url(#vt-mark-grad)"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Inner play triangle */}
          <path d="M16 13 L28 20 L16 27 Z" fill="#ffffff" />
        </svg>
        <span className={styles.markGlow} aria-hidden />
      </span>

      {/* Wordmark */}
      {showText && (
        <span className={styles.wordmark}>
          <span className={styles.word} data-text="Viewtopia">Viewtopia</span>
          <span className={styles.sparkle} aria-hidden>✦</span>
        </span>
      )}
    </span>
  );
}
