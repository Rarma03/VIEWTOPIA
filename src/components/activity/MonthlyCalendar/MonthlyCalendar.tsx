'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format,
  isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isToday,
} from 'date-fns';
import { motion } from 'framer-motion';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import type { WatchlistItem } from '@/types';
import type { MangaTrackerEntry } from '@/lib/mangaTracker';
import styles from './MonthlyCalendar.module.css';

interface MonthlyCalendarProps {
  items: WatchlistItem[];
  /** Optional manga tracker entries — completed ones are bucketed by `finished_at`. */
  mangaEntries?: MangaTrackerEntry[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayBucket {
  date: Date;
  count: number;
  titles: string[];
}

/**
 * Big, friendly monthly heatmap showing how much the user watched on each day.
 * - Cell color intensity scales with the number of titles watched that day.
 * - Hover reveals a tooltip with the day's count and the first few titles.
 * - Prev / next navigation moves one calendar month at a time.
 */
export default function MonthlyCalendar({ items, mangaEntries = [] }: Readonly<MonthlyCalendarProps>) {
  const [cursor, setCursor] = useState<Date>(() => new Date());

  // Bucket watched items + completed manga by their date. Items without a
  // date are ignored. Manga `finished_at` may be either 'YYYY-MM-DD' (local)
  // or a full ISO timestamp (UTC) depending on origin, so we normalise both.
  const buckets = useMemo(() => {
    const map = new Map<string, DayBucket>();
    const addToBucket = (y: number, m: number, d: number, title: string) => {
      const key = `${y}-${m}-${d}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.titles.push(title);
      } else {
        map.set(key, { date: new Date(y, m - 1, d), count: 1, titles: [title] });
      }
    };

    for (const it of items) {
      if (it.status !== 'watched' || !it.watched_date) continue;
      // watched_date stored as YYYY-MM-DD; parse as local-date to avoid TZ drift.
      const [y, m, d] = it.watched_date.split('-').map(Number);
      if (!y || !m || !d) continue;
      addToBucket(y, m, d, it.title);
    }

    for (const e of mangaEntries) {
      if (e.status !== 'completed' || !e.finished_at) continue;
      // finished_at can be 'YYYY-MM-DD' from the local fallback or a full ISO
      // timestamp from Supabase. Both `Date` parses correctly; we then take
      // the *local* y/m/d so the cell lands on the user's calendar day.
      const dt = new Date(e.finished_at.length <= 10 ? `${e.finished_at}T00:00:00` : e.finished_at);
      if (Number.isNaN(dt.getTime())) continue;
      addToBucket(dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), e.title);
    }

    return map;
  }, [items, mangaEntries]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const monthTotal = useMemo(() => {
    let total = 0;
    for (const day of days) {
      if (!isSameMonth(day, cursor)) continue;
      const key = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
      total += buckets.get(key)?.count ?? 0;
    }
    return total;
  }, [days, buckets, cursor]);

  // Compute a max for scaling intensity; cap at 5 so a single huge day doesn't wash out everything.
  const maxCount = useMemo(() => {
    let m = 0;
    for (const v of buckets.values()) m = Math.max(m, v.count);
    return Math.min(Math.max(m, 1), 5);
  }, [buckets]);

  const getKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={() => setCursor((c) => subMonths(c, 1))} aria-label="Previous month">
          <HiChevronLeft size={18} />
        </button>
        <div className={styles.monthLabel}>
          <h3>{format(cursor, 'MMMM yyyy')}</h3>
          <span className={styles.totalBadge}>{monthTotal} watched</span>
        </div>
        <button className={styles.navBtn} onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
          <HiChevronRight size={18} />
        </button>
      </div>

      <div className={styles.weekRow}>
        {WEEKDAYS.map((w) => <div key={w} className={styles.weekday}>{w}</div>)}
      </div>

      <div className={styles.grid}>
        {days.map((day) => {
          const key = getKey(day);
          const bucket = buckets.get(key);
          const inMonth = isSameMonth(day, cursor);
          const intensity = bucket ? Math.min(bucket.count / maxCount, 1) : 0;
          // Compose class list
          const cellClass = [
            styles.cell,
            inMonth ? '' : styles.outside,
            isToday(day) ? styles.today : '',
            bucket ? styles.hasData : '',
          ].filter(Boolean).join(' ');

          // Background tint scales with intensity; base is transparent.
          const cellStyle = bucket
            ? { background: `rgba(99, 102, 241, ${0.15 + intensity * 0.55})` }
            : undefined;

          return (
            <motion.div
              key={key}
              className={cellClass}
              style={cellStyle}
              whileHover={{ scale: 1.04 }}
              transition={{ duration: 0.12 }}
            >
              <span className={styles.dayNum}>{format(day, 'd')}</span>
              {bucket && (
                <>
                  <span className={styles.count}>{bucket.count}</span>
                  <div className={styles.tooltip} role="tooltip">
                    <strong>{format(day, 'EEE, MMM d')}</strong>
                    <span className={styles.tooltipCount}>{bucket.count} watched</span>
                    <ul>
                      {bucket.titles.slice(0, 5).map((t, i) => (
                        <li key={`${t}-${i}`}>{t}</li>
                      ))}
                      {bucket.titles.length > 5 && (
                        <li className={styles.more}>+{bucket.titles.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className={styles.legend}>
        <span>Less</span>
        {[0.15, 0.3, 0.5, 0.7].map((a) => (
          <span key={a} className={styles.legendCell} style={{ background: `rgba(99, 102, 241, ${a})` }} />
        ))}
        <span className={styles.legendCell} style={{ background: 'rgba(99, 102, 241, 0.85)' }} />
        <span>More</span>
      </div>
    </div>
  );
}
