'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiCalendar, HiXMark } from 'react-icons/hi2';
import styles from './WatchedDateModal.module.css';

interface WatchedDateModalProps {
  open: boolean;
  title?: string;
  /** Pre-fill if the user previously set a date. */
  initialDate?: string | null;
  /** Called with an ISO date (YYYY-MM-DD) or null for "don't remember". */
  onConfirm: (date: string | null) => void;
  onCancel: () => void;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Modal that asks the user when they watched a title before marking it
 * watched. Defaults to today; offers a "Don't remember" escape hatch.
 */
export default function WatchedDateModal({
  open,
  title,
  initialDate,
  onConfirm,
  onCancel,
}: WatchedDateModalProps) {
  const [date, setDate] = useState<string>(initialDate || todayISO());

  // Reset to a sensible default each time the modal opens.
  useEffect(() => {
    if (open) setDate(initialDate || todayISO());
  }, [open, initialDate]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className={styles.dialog}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button className={styles.close} onClick={onCancel} aria-label="Close">
              <HiXMark size={18} />
            </button>
            <div className={styles.iconWrap}><HiCalendar size={28} /></div>
            <h3 className={styles.title}>When did you watch{title ? ` ${title}` : ' it'}?</h3>
            <p className={styles.hint}>Defaults to today &mdash; pick a different date if you watched it earlier.</p>

            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className={styles.dateInput}
              autoFocus
            />

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => onConfirm(null)}
              >
                Don&apos;t remember
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => onConfirm(date || null)}
                disabled={!date}
              >
                Mark watched
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
