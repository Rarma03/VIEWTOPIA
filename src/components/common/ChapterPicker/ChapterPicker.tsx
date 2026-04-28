'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiCheck, HiXMark, HiMinus, HiPlus } from 'react-icons/hi2';
import styles from './ChapterPicker.module.css';

interface ChapterPickerProps {
  open: boolean;
  title: string;
  totalChapters: number | null; // null when source is unknown
  initialValue: number;
  onCancel: () => void;
  onSave: (chaptersRead: number) => void;
}

/**
 * Creative chapter-progress picker that combines three input modes:
 *
 * 1. Big-number display with ±1 / ±5 / ±10 steppers and a "Caught up" button.
 * 2. A range slider for fast skimming when the total is known, with tick
 *    labels at 0, 25%, 50%, 75% and 100%.
 * 3. A scrollable chapter grid (one tile per chapter) for direct selection —
 *    great for completionists. Disabled gracefully when total is unknown.
 *
 * The user can flip between Slider and Grid modes; both stay in sync with
 * the same internal `value` state so toggling never loses progress.
 */
export default function ChapterPicker({
  open,
  title,
  totalChapters,
  initialValue,
  onCancel,
  onSave,
}: Readonly<ChapterPickerProps>) {
  const [value, setValue] = useState(initialValue);
  const [mode, setMode] = useState<'slider' | 'grid'>('slider');

  // Reset internal state when (re)opened so it doesn't leak between titles.
  useEffect(() => {
    if (open) setValue(Math.max(0, initialValue || 0));
  }, [open, initialValue]);

  // ESC closes; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'ArrowRight') setValue((v) => clamp(v + 1, totalChapters));
      if (e.key === 'ArrowLeft') setValue((v) => clamp(v - 1, totalChapters));
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel, totalChapters]);

  const pct = useMemo(() => {
    if (!totalChapters || totalChapters <= 0) return 0;
    return Math.min(100, Math.round((value / totalChapters) * 100));
  }, [value, totalChapters]);

  if (!open) return null;

  const knownTotal = typeof totalChapters === 'number' && totalChapters > 0;
  const sliderMax = knownTotal ? totalChapters! : Math.max(value + 50, 100);

  const set = (n: number) => setValue(clamp(n, totalChapters));

  return (
    <AnimatePresence>
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <motion.div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-label="Set reading progress"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.18 }}
        >
          <div className={styles.header}>
            <div className={styles.titleBlock}>
              <div className={styles.kicker}>Reading Progress</div>
              <div className={styles.title}>{title}</div>
            </div>
            <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">
              <HiXMark size={18} />
            </button>
          </div>

          {!knownTotal && (
            <div className={styles.unknownBanner}>
              The source doesn&rsquo;t list a final chapter count yet — track any number and we&rsquo;ll
              update the total when it&rsquo;s known.
            </div>
          )}

          {/* Big number display */}
          <div className={styles.wheel}>
            <div className={styles.bigNumberLabel}>Chapters Read</div>
            <div className={styles.bigNumber}>
              <span className={styles.bigNumberValue}>{value}</span>
              {knownTotal && (
                <span className={styles.bigNumberOf}>/ {totalChapters}</span>
              )}
            </div>

            <div className={styles.steppers}>
              <button
                className={styles.stepper}
                onClick={() => set(value - 10)}
                disabled={value === 0}
              >
                −10
              </button>
              <button
                className={styles.stepper}
                onClick={() => set(value - 1)}
                disabled={value === 0}
                aria-label="Minus one"
              >
                <HiMinus size={14} />
              </button>
              <button
                className={`${styles.stepper} ${styles.stepperPrimary}`}
                onClick={() => set(value + 1)}
                disabled={knownTotal && value >= totalChapters!}
                aria-label="Plus one"
              >
                <HiPlus size={14} />
              </button>
              <button
                className={styles.stepper}
                onClick={() => set(value + 10)}
                disabled={knownTotal && value >= totalChapters!}
              >
                +10
              </button>
              {knownTotal && (
                <button
                  className={styles.stepper}
                  onClick={() => set(totalChapters!)}
                  disabled={value >= totalChapters!}
                  title="Mark all chapters as read"
                >
                  Caught up
                </button>
              )}
            </div>
          </div>

          {/* Mode toggle */}
          <div className={styles.tabBar}>
            <button
              className={`${styles.tab} ${mode === 'slider' ? styles.tabActive : ''}`}
              onClick={() => setMode('slider')}
            >
              Slider
            </button>
            <button
              className={`${styles.tab} ${mode === 'grid' ? styles.tabActive : ''}`}
              onClick={() => setMode('grid')}
              disabled={!knownTotal}
              title={knownTotal ? '' : 'Grid view requires a known chapter count'}
            >
              Grid
            </button>
          </div>

          {mode === 'slider' ? (
            <div className={styles.sliderBlock}>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={sliderMax}
                value={value}
                step={1}
                onChange={(e) => set(Number(e.target.value))}
                style={{ ['--pct' as never]: `${pct}%` }}
              />
              {knownTotal && (
                <div className={styles.tickRow}>
                  <span>0</span>
                  <span>{Math.round(totalChapters! * 0.25)}</span>
                  <span>{Math.round(totalChapters! * 0.5)}</span>
                  <span>{Math.round(totalChapters! * 0.75)}</span>
                  <span>{totalChapters}</span>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.gridScroll}>
              <div className={styles.grid}>
                {knownTotal &&
                  Array.from({ length: totalChapters! }, (_, i) => {
                    const ch = i + 1;
                    const read = ch <= value;
                    const current = ch === value;
                    return (
                      <button
                        key={ch}
                        className={`${styles.cell} ${read ? styles.cellRead : ''} ${current ? styles.cellCurrent : ''}`}
                        onClick={() => set(ch)}
                        title={`Mark up to chapter ${ch}`}
                      >
                        {ch}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
            <button
              className={styles.saveBtn}
              onClick={() => onSave(value)}
            >
              <HiCheck size={16} /> Save progress
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function clamp(n: number, max: number | null): number {
  if (n < 0) return 0;
  if (max != null && max > 0 && n > max) return max;
  return n;
}
