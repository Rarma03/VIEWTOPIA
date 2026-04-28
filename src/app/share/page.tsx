'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiFilm, HiTv, HiSparkles, HiArrowLeft } from 'react-icons/hi2';
import { decodeCollection } from '@/lib/share';
import { tmdbImage } from '@/lib/tmdb';
import { useTheme } from '@/context/ThemeContext';
import { MediaType } from '@/types';
import styles from './share.module.css';

const MEDIA_ICONS: Record<MediaType, React.ComponentType<{ size?: number }>> = {
  movie: HiFilm,
  tv: HiTv,
  anime: HiSparkles,
};

function ShareContent() {
  const { isDark } = useTheme();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ReturnType<typeof decodeCollection>>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const encoded = searchParams.get('c');
    if (!encoded) { setError(true); return; }
    const decoded = decodeCollection(encoded);
    if (!decoded) { setError(true); return; }
    setData(decoded);
  }, [searchParams]);

  if (error) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container}>
          <div className={styles.error}>
            <h1>Invalid Share Link</h1>
            <p>This link is broken or expired.</p>
            <Link href="/" className={styles.homeBtn}><HiArrowLeft size={16} /> Go Home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const getHref = (mediaType: MediaType, mediaId: number) => {
    if (mediaType === 'anime') return `/anime/${mediaId}`;
    if (mediaType === 'tv') return `/tv/${mediaId}`;
    return `/movies/${mediaId}`;
  };

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <motion.div className={styles.header} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className={styles.title}>{data.n}</h1>
          <p className={styles.subtitle}>
            By {data.u} &middot; {data.items.length} titles {data.desc ? `— ${data.desc}` : ''} &middot; Shared on {data.d}
          </p>
          <Link href="/" className={styles.homeBtn}><HiArrowLeft size={16} /> Back to Viewtopia</Link>
        </motion.div>

        <div className={styles.grid}>
          {data.items.map((item) => {
            const Icon = MEDIA_ICONS[item.t];
            const isExternal = item.p?.startsWith('http');
            return (
              <Link key={`${item.t}-${item.i}`} href={getHref(item.t, item.i)} className={styles.card}>
                <div className={styles.poster}>
                  {item.p ? (
                    <Image src={isExternal ? item.p : tmdbImage(item.p)} alt={item.n} fill sizes="160px" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className={styles.noPoster}><Icon size={28} /></div>
                  )}
                </div>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardTitle}>{item.n}</h3>
                  <span className={styles.typeBadge}><Icon size={12} /> {item.t}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense>
      <ShareContent />
    </Suspense>
  );
}
