'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProfileByUsername } from '@/lib/store';
import Loader from '@/components/common/Loader';
import { ProfileView } from '@/app/profile/[userId]/page';

export default function UsernameProfilePage({ params }: Readonly<{ params: Promise<{ username: string }> }>) {
  const { username } = use(params);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void getProfileByUsername(username).then((profile) => {
      if (cancelled) return;
      if (profile) {
        setUserId(profile.id);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => {
    if (!notFound) return;
    const t = setTimeout(() => router.replace('/global?tab=users'), 1200);
    return () => clearTimeout(t);
  }, [notFound, router]);

  if (loading) return <Loader />;
  if (notFound || !userId) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center', opacity: 0.8 }}>
        <h2>User not found</h2>
        <p>Redirecting…</p>
      </div>
    );
  }

  return <ProfileView userId={userId} />;
}
