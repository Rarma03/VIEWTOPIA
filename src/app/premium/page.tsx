'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  HiStar, HiCheck, HiArrowDownTray, HiShare, HiSparkles,
  HiShieldCheck, HiCreditCard, HiDevicePhoneMobile, HiArrowLeft,
} from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { isPremiumUser, togglePremium } from '@/lib/store';
import toast from 'react-hot-toast';
import styles from './premium.module.css';

const FEATURES = [
  { icon: HiArrowDownTray, text: 'Export your watchlist (JSON, Markdown, Text)' },
  { icon: HiShare, text: 'Share collections with friends' },
  { icon: HiSparkles, text: 'Premium badge & golden avatar glow' },
  { icon: HiShieldCheck, text: 'Early access to new features' },
];

export default function PremiumPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | null>(null);
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const [alreadyPremium, setAlreadyPremium] = useState(false);
  useEffect(() => {
    if (!user) { setAlreadyPremium(false); return; }
    void isPremiumUser(user.id).then(setAlreadyPremium);
  }, [user]);

  const handleActivateFree = async () => {
    if (!user) { router.push('/login'); return; }
    await togglePremium(user.id);
    setAlreadyPremium(true);
    toast.success('Premium activated for free! Welcome aboard 🎉');
    setTimeout(() => router.push('/'), 600);
  };

  const handlePay = () => {
    // Payment gateway integration placeholder
    toast('Payment gateway coming soon! Use the free activation button below.', { icon: '🚧' });
  };

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <HiArrowLeft size={16} /> Back
        </button>

        {alreadyPremium ? (
          <motion.div
            className={styles.alreadyPremium}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <HiStar size={48} className={styles.starIcon} />
            <h1 className={styles.alreadyTitle}>You&apos;re Premium!</h1>
            <p className={styles.alreadySubtitle}>
              You have access to all premium features. Thank you for supporting Viewtopia!
            </p>
            <button className={styles.homeBtn} onClick={() => router.push('/')}>
              Go to Home
            </button>
          </motion.div>
        ) : (
          <div className={styles.split}>
            {/* Left — Pricing */}
            <motion.div
              className={styles.pricingCard}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className={styles.pricingBadge}>
                <HiStar size={18} /> Viewtopia Premium
              </div>

              <div className={styles.priceBlock}>
                <span className={styles.currency}>₹</span>
                <span className={styles.amount}>10</span>
                <span className={styles.period}>/month</span>
              </div>

              <p className={styles.pricingNote}>Less than a cup of chai ☕</p>

              <ul className={styles.features}>
                {FEATURES.map((feat, i) => (
                  <li key={i} className={styles.feature}>
                    <span className={styles.featureIcon}><feat.icon size={16} /></span>
                    <span>{feat.text}</span>
                  </li>
                ))}
              </ul>

              <div className={styles.guarantee}>
                <HiCheck size={14} /> Cancel anytime • No hidden charges
              </div>
            </motion.div>

            {/* Right — Payment */}
            <motion.div
              className={styles.paymentCard}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h2 className={styles.paymentTitle}>Choose Payment Method</h2>

              <div className={styles.methodTabs}>
                <button
                  className={`${styles.methodTab} ${paymentMethod === 'upi' ? styles.activeMethod : ''}`}
                  onClick={() => setPaymentMethod('upi')}
                >
                  <HiDevicePhoneMobile size={18} /> UPI
                </button>
                <button
                  className={`${styles.methodTab} ${paymentMethod === 'card' ? styles.activeMethod : ''}`}
                  onClick={() => setPaymentMethod('card')}
                >
                  <HiCreditCard size={18} /> Card
                </button>
              </div>

              {paymentMethod === 'upi' && (
                <motion.div
                  className={styles.methodForm}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key="upi"
                >
                  <label className={styles.label}>UPI ID</label>
                  <input
                    type="text"
                    placeholder="yourname@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className={styles.input}
                  />
                  <button className={styles.payBtn} onClick={handlePay}>
                    Pay ₹10 via UPI
                  </button>
                </motion.div>
              )}

              {paymentMethod === 'card' && (
                <motion.div
                  className={styles.methodForm}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key="card"
                >
                  <label className={styles.label}>Card Number</label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/[^\d\s]/g, '').slice(0, 19))}
                    className={styles.input}
                    maxLength={19}
                  />
                  <div className={styles.cardRow}>
                    <div className={styles.cardField}>
                      <label className={styles.label}>Expiry</label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value.replace(/[^\d/]/g, '').slice(0, 5))}
                        className={styles.input}
                        maxLength={5}
                      />
                    </div>
                    <div className={styles.cardField}>
                      <label className={styles.label}>CVV</label>
                      <input
                        type="password"
                        placeholder="•••"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className={styles.input}
                        maxLength={4}
                      />
                    </div>
                  </div>
                  <button className={styles.payBtn} onClick={handlePay}>
                    Pay ₹10 via Card
                  </button>
                </motion.div>
              )}

              {!paymentMethod && (
                <p className={styles.selectHint}>Select a payment method above to continue</p>
              )}

              {/* Free activation for testing */}
              <div className={styles.freeSection}>
                <div className={styles.freeDivider}>
                  <span>or</span>
                </div>
                <p className={styles.freeNote}>
                  🎉 We&apos;re in beta! All early users get Premium for free.
                </p>
                <button className={styles.freeBtn} onClick={handleActivateFree}>
                  <HiSparkles size={16} /> Activate Premium — Free
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
