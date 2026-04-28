import { Collection, MediaType } from '@/types';

interface ShareItem {
  i: number;       // media_id
  t: MediaType;    // media_type
  n: string;       // title
  p: string | null; // poster_path
}

interface ShareData {
  u: string; // user display name
  n: string; // collection name
  d: string; // date generated
  desc: string | null; // collection description
  items: ShareItem[];
}

export function encodeCollection(
  displayName: string,
  collection: Collection
): string {
  const data: ShareData = {
    u: displayName,
    n: collection.name,
    d: new Date().toISOString().split('T')[0],
    desc: collection.description,
    items: collection.items.map((item) => ({
      i: item.media_id,
      t: item.media_type,
      n: item.title,
      p: item.poster_path,
    })),
  };

  const json = JSON.stringify(data);
  if (typeof window !== 'undefined') {
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  return Buffer.from(json).toString('base64url');
}

export function decodeCollection(encoded: string): ShareData | null {
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    let json: string;
    if (typeof window !== 'undefined') {
      json = decodeURIComponent(escape(atob(b64)));
    } else {
      json = Buffer.from(b64, 'base64').toString('utf-8');
    }

    const data = JSON.parse(json) as ShareData;
    if (!data.u || !data.n || !Array.isArray(data.items)) return null;
    if (data.items.length > 500) return null;

    return data;
  } catch {
    return null;
  }
}

export function getShareUrl(encoded: string): string {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : 'http://localhost:3000';
  return `${base}/share?c=${encoded}`;
}
