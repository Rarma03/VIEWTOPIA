'use client';

/**
 * Lazily-loaded Google AdSense slot.
 *
 * Behaviour:
 *  - When `NEXT_PUBLIC_ADSENSE_CLIENT` is unset, renders a friendly placeholder
 *    so the surrounding UI still looks intentional during development.
 *  - When set, injects the AdSense loader script ONCE (idempotent), then
 *    renders an `<ins class="adsbygoogle">` block and pushes it.
 *
 * Configure via `.env.local`:
 *   NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
 *   NEXT_PUBLIC_ADSENSE_SLOT=1234567890
 *   NEXT_PUBLIC_ADSENSE_FORMAT=auto         (optional; defaults to "auto")
 *
 * No app code changes needed once you add the env vars and redeploy.
 */

import { useEffect, useRef } from 'react';
import styles from './AdSlot.module.css';

const SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  /** Override the env client id, e.g. for testing. */
  client?: string;
  /** Override the env slot id. */
  slot?: string;
  /** AdSense `data-ad-format`. Defaults to env or `"auto"`. */
  format?: string;
  /** Optional inline style hook for height etc. */
  style?: React.CSSProperties;
}

function injectAdSenseScript(client: string): void {
  if (typeof globalThis === 'undefined' || typeof globalThis.document === 'undefined') return;
  // Don't inject twice.
  const existing = globalThis.document.querySelector(`script[src^="${SCRIPT_SRC}"]`);
  if (existing) return;
  const s = globalThis.document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `${SCRIPT_SRC}?client=${encodeURIComponent(client)}`;
  globalThis.document.head.appendChild(s);
}

export default function AdSlot({ client, slot, format, style }: Readonly<AdSlotProps>) {
  const insRef = useRef<HTMLModElement | null>(null);

  const adClient = client ?? process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? '';
  const adSlot = slot ?? process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? '';
  const adFormat = format ?? process.env.NEXT_PUBLIC_ADSENSE_FORMAT ?? 'auto';

  const isConfigured = Boolean(adClient && adSlot);

  useEffect(() => {
    if (!isConfigured) return;
    injectAdSenseScript(adClient);
    // Push the slot to the queue. Wrap in try/catch since AdSense throws
    // synchronously when the slot is already rendered or container width is 0.
    try {
      (globalThis.window.adsbygoogle = globalThis.window.adsbygoogle ?? []).push({});
    } catch {
      /* no-op — AdSense will retry on next push */
    }
  }, [isConfigured, adClient, adSlot]);

  if (!isConfigured) {
    return (
      <div className={styles.placeholder} style={style}>
        <div className={styles.placeholderInner}>
          <span className={styles.placeholderTag}>Sponsored</span>
          <p className={styles.placeholderText}>
            Ad placeholder
          </p>
          <p className={styles.placeholderHint}>
            Set <code>NEXT_PUBLIC_ADSENSE_CLIENT</code> and{' '}
            <code>NEXT_PUBLIC_ADSENSE_SLOT</code> in <code>.env.local</code> to
            display real ads here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: 'block', ...style }}
      data-ad-client={adClient}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive="true"
    />
  );
}
