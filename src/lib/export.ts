import { WatchlistItem } from '@/types';
import { MEDIA_TYPE_LABELS, WATCH_STATUS_LABELS } from '@/lib/constants';

export type ExportFormat = 'json' | 'md' | 'txt' | 'csv' | 'pdf';

/** Formats that require a Premium subscription. PDF is free for everyone. */
export const PREMIUM_EXPORT_FORMATS: ReadonlySet<ExportFormat> = new Set(['json', 'md', 'txt', 'csv']);

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toJSON(items: WatchlistItem[], displayName: string): string {
  const data = {
    exported_by: displayName,
    exported_at: new Date().toISOString(),
    total_items: items.length,
    watchlist: items.map((item) => ({
      title: item.title,
      type: MEDIA_TYPE_LABELS[item.media_type],
      status: WATCH_STATUS_LABELS[item.status],
      rating: item.user_rating ?? null,
      watched_date: item.watched_date ?? null,
      added_date: item.added_at,
    })),
  };
  return JSON.stringify(data, null, 2);
}

function toMarkdown(items: WatchlistItem[], displayName: string): string {
  const lines: string[] = [
    `# ${displayName}'s Watchlist`,
    ``,
    `> Exported on ${formatDate(new Date().toISOString())} • ${items.length} items`,
    ``,
  ];

  const grouped = {
    watched: items.filter((i) => i.status === 'watched'),
    watching: items.filter((i) => i.status === 'watching'),
    watchlist: items.filter((i) => i.status === 'watchlist'),
    dropped: items.filter((i) => i.status === 'dropped'),
  };

  for (const [status, group] of Object.entries(grouped)) {
    if (group.length === 0) continue;
    lines.push(`## ${WATCH_STATUS_LABELS[status as keyof typeof grouped]} (${group.length})`);
    lines.push('');
    lines.push('| # | Title | Type | Rating | Date |');
    lines.push('|---|-------|------|--------|------|');
    group.forEach((item, i) => {
      const rating = item.user_rating ? `${item.user_rating}/10` : '—';
      const date = item.watched_date ? formatDate(item.watched_date) : '—';
      lines.push(`| ${i + 1} | ${item.title} | ${MEDIA_TYPE_LABELS[item.media_type]} | ${rating} | ${date} |`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('*Exported from Viewtopia*');
  return lines.join('\n');
}

function toText(items: WatchlistItem[], displayName: string): string {
  const lines: string[] = [
    `${displayName}'s Watchlist`,
    `Exported: ${formatDate(new Date().toISOString())} | ${items.length} items`,
    '='.repeat(60),
    '',
  ];

  const grouped = {
    watched: items.filter((i) => i.status === 'watched'),
    watching: items.filter((i) => i.status === 'watching'),
    watchlist: items.filter((i) => i.status === 'watchlist'),
    dropped: items.filter((i) => i.status === 'dropped'),
  };

  for (const [status, group] of Object.entries(grouped)) {
    if (group.length === 0) continue;
    lines.push(`[ ${WATCH_STATUS_LABELS[status as keyof typeof grouped].toUpperCase()} ] — ${group.length} items`);
    lines.push('-'.repeat(40));
    group.forEach((item, i) => {
      const rating = item.user_rating ? ` ★ ${item.user_rating}/10` : '';
      const type = MEDIA_TYPE_LABELS[item.media_type];
      lines.push(`  ${i + 1}. ${item.title} (${type})${rating}`);
    });
    lines.push('');
  }

  lines.push('— Exported from Viewtopia');
  return lines.join('\n');
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function toCsv(items: WatchlistItem[]): string {
  const header = ['#', 'Title', 'Type', 'Status', 'Rating', 'Watched Date', 'Added Date'];
  const rows = items.map((item, i) => [
    i + 1,
    escapeCsv(item.title),
    escapeCsv(MEDIA_TYPE_LABELS[item.media_type]),
    escapeCsv(WATCH_STATUS_LABELS[item.status]),
    item.user_rating ?? '',
    escapeCsv(item.watched_date ?? ''),
    escapeCsv(item.added_at ?? ''),
  ].join(','));
  return [header.join(','), ...rows].join('\r\n');
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Generates a print-ready HTML document and opens it in a new window with the
 * browser's print dialog. The user can then save it as a PDF — no extra
 * dependency required.
 */
function exportPdf(items: WatchlistItem[], displayName: string): void {
  const grouped = {
    watching: items.filter((i) => i.status === 'watching'),
    watchlist: items.filter((i) => i.status === 'watchlist'),
    watched: items.filter((i) => i.status === 'watched'),
    dropped: items.filter((i) => i.status === 'dropped'),
  };

  const sections = (Object.entries(grouped) as Array<[keyof typeof grouped, WatchlistItem[]]>)
    .filter(([, group]) => group.length > 0)
    .map(([status, group]) => {
      const rows = group.map((item, i) => {
        const rating = item.user_rating ? `${item.user_rating}/10` : '—';
        const date = item.watched_date ? formatDate(item.watched_date) : '—';
        return `<tr><td>${i + 1}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(MEDIA_TYPE_LABELS[item.media_type])}</td><td>${rating}</td><td>${date}</td></tr>`;
      }).join('');
      return `
        <h2>${escapeHtml(WATCH_STATUS_LABELS[status])} <span class="cnt">${group.length}</span></h2>
        <table>
          <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Rating</th><th>Date</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(displayName)}'s Watchlist</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;padding:32px;max-width:900px;margin:0 auto}
  header{border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}
  h1{margin:0 0 6px;font-size:28px}
  .meta{color:#666;font-size:13px}
  h2{margin:28px 0 10px;font-size:18px;display:flex;align-items:center;gap:8px}
  .cnt{background:#111;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e5e5e5}
  th{background:#f6f6f6;font-weight:600}
  tr:nth-child(even) td{background:#fafafa}
  footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e5e5;color:#888;font-size:11px;text-align:center}
  @media print{body{padding:0}}
</style></head>
<body>
  <header>
    <h1>${escapeHtml(displayName)}&rsquo;s Watchlist</h1>
    <div class="meta">Exported ${formatDate(new Date().toISOString())} &middot; ${items.length} items</div>
  </header>
  ${sections || '<p>No items.</p>'}
  <footer>Exported from Viewtopia</footer>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=900,height=700');
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked. Please allow popups to download as PDF.');
  }
  // Give the new window a moment to render before invoking print, then revoke.
  win.addEventListener('load', () => {
    setTimeout(() => {
      win.print();
      URL.revokeObjectURL(url);
    }, 250);
  });
}

export function exportWatchlist(items: WatchlistItem[], displayName: string, format: ExportFormat): void {
  if (format === 'pdf') {
    exportPdf(items, displayName);
    return;
  }

  let content: string;
  let filename: string;
  let mimeType: string;

  switch (format) {
    case 'json':
      content = toJSON(items, displayName);
      filename = `viewtopia-watchlist-${Date.now()}.json`;
      mimeType = 'application/json';
      break;
    case 'md':
      content = toMarkdown(items, displayName);
      filename = `viewtopia-watchlist-${Date.now()}.md`;
      mimeType = 'text/markdown';
      break;
    case 'txt':
      content = toText(items, displayName);
      filename = `viewtopia-watchlist-${Date.now()}.txt`;
      mimeType = 'text/plain';
      break;
    case 'csv':
      content = toCsv(items);
      filename = `viewtopia-watchlist-${Date.now()}.csv`;
      mimeType = 'text/csv';
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
