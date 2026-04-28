'use client';

/**
 * Floating "Sponsored" ribbon. Sits below the History ribbon on the right
 * edge. Clicking opens a modal that hosts a Google AdSense slot via
 * `<AdSlot />`. Until you configure AdSense env vars the modal renders a
 * styled placeholder.
 *
 * Visible everywhere except inside the modal itself; closes on Escape, on
 * backdrop click, or via the close button.
 */

import { useCallback, useEffect, useState } from 'react';
import { HiMegaphone, HiXMark } from 'react-icons/hi2';
import AdSlot from '@/components/common/AdSlot/AdSlot';
import styles from './AdRibbon.module.css';

export default function AdRibbon() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Lock body scroll while open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = globalThis.document?.body?.style?.overflow ?? '';
    if (globalThis.document?.body) globalThis.document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    globalThis.window?.addEventListener('keydown', onKey);
    return () => {
      if (globalThis.document?.body) globalThis.document.body.style.overflow = prev;
      globalThis.window?.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className={styles.ribbon}
        aria-label="Open sponsored content"
        title="Sponsored"
        onClick={() => setOpen(true)}
      >
        <span className={styles.label}>Sponsored</span>
        <span className={styles.circle}>
          <HiMegaphone size={20} />
        </span>
      </button>

      {open && (
        // Overlay: a non-button element to avoid `<button>` inside `<button>`
        // hydration errors. Click anywhere on the backdrop to dismiss.
        <div
          className={styles.overlay}
          role="presentation"
          onClick={close}
        >
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Sponsored content"
            onClick={(e) => e.stopPropagation()}
          >
            <header className={styles.header}>
              <span className={styles.headerTag}>Sponsored</span>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={close}
                aria-label="Close"
              >
                <HiXMark size={18} />
              </button>
            </header>
            <div className={styles.body}>
              <AdSlot />
            </div>
            <footer className={styles.footer}>
              Ads help keep the site free. Thanks for your support!
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
