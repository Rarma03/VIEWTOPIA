'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  HiArrowLeft, HiCog6Tooth, HiCheck, HiExclamationTriangle,
  HiUser, HiAtSymbol, HiMapPin,
} from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase';
import { isUsernameAvailable } from '@/lib/store';
import toast from 'react-hot-toast';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import styles from './settings.module.css';

export default function SettingsPage() {
  const { isDark } = useTheme();
  const { user, logout, refreshProfile } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [nameStatus, setNameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    setDisplayName(user.display_name);
    setUsername(user.username);
    setCity(user.city || '');
  }, [user, router]);

  const validateUsername = (val: string) => {
    if (val.length < 3) return 'Must be at least 3 characters';
    if (val.length > 20) return 'Must be 20 characters or fewer';
    if (!/^[a-z0-9_]+$/.test(val)) return 'Only lowercase letters, numbers, and underscores';
    return '';
  };

  const handleUsernameChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setUsernameError(validateUsername(cleaned));
    setNameStatus('idle');
  };

  // Debounced live availability check
  useEffect(() => {
    if (!user) return;
    if (validateUsername(username)) { setNameStatus('idle'); return; }
    if (username === user.username) { setNameStatus('idle'); return; }
    setNameStatus('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      const ok = await isUsernameAvailable(username, user.id);
      if (cancelled) return;
      setNameStatus(ok ? 'available' : 'taken');
      if (!ok) setUsernameError('Username already taken');
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, user]);

  const handleSave = async () => {
    if (!user) return;
    const err = validateUsername(username);
    if (err) { setUsernameError(err); return; }
    if (nameStatus === 'taken') { setUsernameError('Username already taken'); return; }
    if (nameStatus === 'checking') { toast('Still checking username…'); return; }
    if (!displayName.trim()) { toast.error('Display name cannot be empty'); return; }
    if (!isSupabaseConfigured) { toast.error('Supabase is not configured'); return; }

    setSaving(true);
    const { error: updateError } = await getSupabase()
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        username,
        display_name: displayName.trim(),
        city: city.trim() || null,
        onboarded: true,
      }, { onConflict: 'id' });

    if (updateError) {
      if (updateError.code === '23505') {
        setUsernameError('Username already taken');
        toast.error('Username already taken');
      } else {
        toast.error(updateError.message || 'Could not save profile');
      }
      setSaving(false);
      return;
    }

    await refreshProfile();
    toast.success('Profile updated!');
    setSaving(false);
    router.push(username ? `/u/${username}` : `/profile/${user.id}`);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!user) return null;

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href={user.username ? `/u/${user.username}` : `/profile/${user.id}`} className={styles.backBtn}>
            <HiArrowLeft size={18} /> Back to Profile
          </Link>
        </div>

        <motion.div className={styles.card} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={styles.cardHeader}>
            <HiCog6Tooth size={22} />
            <h1 className={styles.title}>Profile Settings</h1>
          </div>

          <div className={styles.form}>
            {/* Display Name */}
            <div className={styles.field}>
              <label className={styles.label}>
                <HiUser size={15} /> Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={styles.input}
                maxLength={30}
                placeholder="Your display name"
              />
              <span className={styles.hint}>{displayName.length}/30</span>
            </div>

            {/* Username */}
            <div className={styles.field}>
              <label className={styles.label}>
                <HiAtSymbol size={15} /> Username
              </label>
              <div className={styles.usernameWrap}>
                <span className={styles.usernamePrefix}>@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={`${styles.input} ${styles.usernameInput}`}
                  maxLength={20}
                  placeholder="your_username"
                />
              </div>
              {usernameError ? (
                <span className={styles.error}><HiExclamationTriangle size={13} /> {usernameError}</span>
              ) : nameStatus === 'checking' ? (
                <span className={styles.hint}>Checking availability…</span>
              ) : nameStatus === 'taken' ? (
                <span className={styles.error}><HiExclamationTriangle size={13} /> Username already taken</span>
              ) : nameStatus === 'available' ? (
                <span className={styles.success}><HiCheck size={13} /> Available</span>
              ) : username && username === user.username ? (
                <span className={styles.hint}>This is your current username</span>
              ) : username.length >= 3 ? (
                <span className={styles.hint}>3-20 characters, letters, numbers, underscores</span>
              ) : (
                <span className={styles.hint}>3-20 characters, letters, numbers, underscores</span>
              )}
              <p className={styles.urlPreview}>
                Your profile URL: <strong>{typeof window !== 'undefined' ? window.location.origin : ''}/u/{username || '...'}</strong>
              </p>
            </div>

            {/* City */}
            <div className={styles.field}>
              <label className={styles.label}>
                <HiMapPin size={15} /> City
              </label>
              <LocationAutocomplete
                value={city}
                onChange={setCity}
                placeholder="e.g. Mumbai, New York, London..."
                maxLength={50}
              />
              <span className={styles.hint}>Used to find Watch Parties near you</span>
            </div>

            {/* Save */}
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={saving || !!usernameError || !displayName.trim()}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div className={styles.dangerCard} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className={styles.dangerTitle}>Account</h2>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Log Out
          </button>
        </motion.div>
      </div>
    </div>
  );
}
