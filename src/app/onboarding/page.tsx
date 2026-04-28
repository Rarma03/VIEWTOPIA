'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { HiSparkles, HiAtSymbol, HiArrowRight } from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase';
import { isUsernameAvailable } from '@/lib/store';
import toast from 'react-hot-toast';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import styles from './onboarding.module.css';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export default function OnboardingPage() {
  const { isDark } = useTheme();
  const { user, isLoading, refreshProfile } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [nameStatus, setNameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [checkingName, setCheckingName] = useState(false);

  // Redirect rules
  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    // If profile is already complete, leave the onboarding screen.
    if (user.username && user.city) { router.replace('/'); return; }
    if (user.username) setUsername(user.username);
    if (user.city) setCity(user.city);
  }, [user, isLoading, router]);

  const validateUsername = (val: string) => {
    if (val.length < 3) return 'Must be at least 3 characters';
    if (val.length > 20) return 'Must be 20 characters or fewer';
    if (!USERNAME_REGEX.test(val)) return 'Only lowercase letters, numbers, and underscores';
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

  const checkUsernameAvailable = async (val: string): Promise<boolean> => {
    if (!user) return true;
    return isUsernameAvailable(val, user.id);
  };

  const handleNext = async () => {
    const err = validateUsername(username);
    if (err) { setUsernameError(err); return; }

    setCheckingName(true);
    const available = await checkUsernameAvailable(username);
    setCheckingName(false);

    if (!available) { setUsernameError('Username already taken'); return; }
    setStep(2);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);

    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured');
      setSaving(false);
      return;
    }

    const trimmedCity = city.trim();
    const { error: updateError } = await getSupabase()
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        display_name: user.display_name || username,
        username,
        city: trimmedCity || null,
        onboarded: true,
      }, { onConflict: 'id' });

    if (updateError) {
      // Most common: unique violation on username
      if (updateError.code === '23505') {
        toast.error('Username already taken');
        setStep(1);
        setUsernameError('Username already taken');
      } else {
        toast.error(updateError.message || 'Could not save profile');
      }
      setSaving(false);
      return;
    }

    await refreshProfile();
    toast.success('Welcome to TrackFlix! 🎬');
    setSaving(false);
    router.replace('/');
  };

  if (isLoading || !user) return null;

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Progress */}
          <div className={styles.progress}>
            <div className={`${styles.dot} ${step >= 1 ? styles.activeDot : ''}`} />
            <div className={styles.line} />
            <div className={`${styles.dot} ${step >= 2 ? styles.activeDot : ''}`} />
          </div>

          <div className={styles.icon}><HiSparkles size={32} /></div>
          <h1 className={styles.title}>
            {step === 1 ? 'Choose your username' : 'Where are you based?'}
          </h1>
          <p className={styles.subtitle}>
            {step === 1
              ? 'This is how others will find you on TrackFlix'
              : 'We\'ll use this to find Watch Parties near you (optional)'}
          </p>

          {step === 1 && (
            <motion.div
              className={styles.fieldWrap}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              key="step1"
            >
              <div className={styles.inputGroup}>
                <span className={styles.prefix}><HiAtSymbol size={18} /></span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={styles.input}
                  maxLength={20}
                  placeholder="your_username"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                />
              </div>
              {usernameError && <span className={styles.error}>{usernameError}</span>}
              {!usernameError && nameStatus === 'checking' && (
                <span className={styles.hint}>Checking availability…</span>
              )}
              {!usernameError && nameStatus === 'available' && (
                <span className={styles.success}>✓ Available</span>
              )}
              {!usernameError && nameStatus === 'taken' && (
                <span className={styles.error}>Username already taken</span>
              )}
              <button
                className={styles.nextBtn}
                onClick={handleNext}
                disabled={!!usernameError || username.length < 3 || checkingName || nameStatus === 'checking' || nameStatus === 'taken'}
              >
                {checkingName ? 'Checking…' : 'Next'} <HiArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              className={styles.fieldWrap}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              key="step2"
            >
              <div className={styles.locationField}>
                <LocationAutocomplete
                  value={city}
                  onChange={setCity}
                  placeholder="Start typing a city..."
                  maxLength={50}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && !saving && handleFinish()}
                />
              </div>
              <span className={styles.hint}>You can always change this in Settings</span>
              <div className={styles.finishRow}>
                <button className={styles.skipBtn} onClick={() => { setCity(''); handleFinish(); }} disabled={saving}>
                  Skip for now
                </button>
                <button className={styles.nextBtn} onClick={handleFinish} disabled={saving}>
                  {saving ? 'Setting up…' : 'Let\'s go!'} <HiArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
