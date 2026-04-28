'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { HiHome, HiFilm, HiTv, HiSparkles, HiBookmark, HiClock, HiHeart, HiEye, HiMagnifyingGlass, HiBars3, HiXMark, HiCubeTransparent, HiTrophy, HiRectangleStack, HiShieldCheck, HiUserCircle, HiGlobeAlt, HiCog6Tooth, HiArrowRightOnRectangle, HiStar, HiUserGroup, HiQuestionMarkCircle, HiBookOpen } from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { isPremiumUser } from '@/lib/store';
import { TicketLogo } from '@/components/common/TicketLogo';
import FriendRequestsBell from '@/components/common/FriendRequestsBell';
import styles from './Navbar.module.css';

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  HiHome, HiFilm, HiTv, HiSparkles, HiBookmark, HiClock, HiHeart, HiEye, HiCubeTransparent, HiTrophy, HiRectangleStack, HiShieldCheck, HiUserCircle, HiGlobeAlt, HiUserGroup, HiBookOpen,
};

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: 'HiHome', public: true },
  { href: '/mood', label: 'Mood', icon: 'HiSparkles', public: true },
  { href: '/rankings', label: 'Rankings', icon: 'HiTrophy', public: true },
  { href: '/read', label: 'Read', icon: 'HiBookOpen', public: true },
  { href: '/collections', label: 'Collections', icon: 'HiRectangleStack', public: false },
  { href: '/recommendations', label: 'Recommendations', icon: 'HiHeart', public: false },
  { href: '/global', label: 'Global', icon: 'HiGlobeAlt', public: true },
  { href: '/watch-parties', label: 'Watch Parties', icon: 'HiUserGroup', public: true },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [premium, setPremium] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Check premium status
  useEffect(() => {
    if (!user) { setPremium(false); return; }
    let cancelled = false;
    void isPremiumUser(user.id).then((v) => { if (!cancelled) setPremium(v); });
    return () => { cancelled = true; };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Until the client has mounted, render only public items so SSR markup matches.
  const effectiveAuth = mounted && isAuthenticated;
  const visibleNavItems = NAV_ITEMS.filter((item) => effectiveAuth || item.public);
  const profileHref = user?.username ? `/u/${user.username}` : `/profile/${user?.id}`;

  return (
    <>
      <nav className={`${styles.navbar} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container}>
          {/* Logo */}
          <Link href="/" className={styles.logo}>
            <TicketLogo size={44} />
          </Link>

          {/* Desktop Nav Links */}
          <div className={styles.desktopNav}>
            {visibleNavItems.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                >
                  {Icon && <Icon size={18} />}
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div
                      className={styles.activeIndicator}
                      layoutId="activeNav"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
            {!effectiveAuth && mounted && (
              <Link
                href="/help"
                className={`${styles.navLink} ${styles.navLinkHighlight} ${pathname === '/help' ? styles.active : ''}`}
              >
                <HiQuestionMarkCircle size={18} />
                <span>What We Offer</span>
              </Link>
            )}
          </div>

          {/* Right Side Actions */}
          <div className={styles.actions}>
            <Link href="/search" className={styles.iconBtn} aria-label="Search">
              <HiMagnifyingGlass size={20} />
            </Link>
            {effectiveAuth && <FriendRequestsBell />}
            {effectiveAuth ? (
              <div className={styles.userMenu} ref={dropdownRef}>
                <Link href={profileHref} className={styles.profileLink}>
                  Profile
                </Link>
                <button
                  className={styles.avatarBtn}
                  onClick={() => setDropdownOpen((p) => !p)}
                  aria-label="User menu"
                >
                  <div className={`${styles.avatar} ${premium ? styles.avatarPremium : ''}`}>
                    {user?.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={user.display_name || 'avatar'}
                        width={34}
                        height={34}
                        className={styles.avatarImg}
                        referrerPolicy="no-referrer"
                        unoptimized
                      />
                    ) : (
                      user?.display_name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                </button>
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      className={styles.dropdown}
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className={styles.dropdownHeader}>
                        <span className={styles.dropdownName}>{user?.display_name}</span>
                        <span className={styles.dropdownUsername}>@{user?.username}</span>
                      </div>
                      <div className={styles.dropdownDivider} />
                      <Link
                        href={profileHref}
                        className={styles.dropdownItem}
                        onClick={() => setDropdownOpen(false)}
                      >
                        <HiUserCircle size={17} /> My Profile
                      </Link>
                      <Link
                        href="/settings"
                        className={styles.dropdownItem}
                        onClick={() => setDropdownOpen(false)}
                      >
                        <HiCog6Tooth size={17} /> Settings
                      </Link>
                      <Link
                        href="/help"
                        className={styles.dropdownItem}
                        onClick={() => setDropdownOpen(false)}
                      >
                        <HiQuestionMarkCircle size={17} /> Help & Guide
                      </Link>
                      {premium ? (
                        <Link
                          href="/premium"
                          className={`${styles.dropdownItem} ${styles.dropdownPremiumActive}`}
                          onClick={() => setDropdownOpen(false)}
                        >
                          <HiStar size={17} /> Premium ✓
                        </Link>
                      ) : (
                        <Link
                          href="/premium"
                          className={`${styles.dropdownItem} ${styles.dropdownPremium}`}
                          onClick={() => setDropdownOpen(false)}
                        >
                          <HiStar size={17} /> Get Premium
                        </Link>
                      )}
                      <div className={styles.dropdownDivider} />
                      <button
                        className={`${styles.dropdownItem} ${styles.dropdownLogout}`}
                        onClick={() => { setDropdownOpen(false); logout(); router.push('/login'); }}
                      >
                        <HiArrowRightOnRectangle size={17} /> Log Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link href="/login" className={styles.loginBtn}>
                Login
              </Link>
            )}
            <button className={styles.menuToggle} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
              {mobileMenuOpen ? <HiXMark size={24} /> : <HiBars3 size={24} />}
            </button>
          </div>
        </div>

      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className={`${styles.mobileMenu} ${isDark ? styles.dark : styles.light}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={styles.mobileMenuContent}>
              {visibleNavItems.map((item) => {
                const Icon = iconMap[item.icon];
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.mobileNavLink} ${isActive ? styles.active : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {Icon && <Icon size={22} />}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {!effectiveAuth && (
                <Link
                  href="/help"
                  className={`${styles.mobileNavLink} ${styles.navLinkHighlight}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <HiQuestionMarkCircle size={22} />
                  <span>What We Offer</span>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
